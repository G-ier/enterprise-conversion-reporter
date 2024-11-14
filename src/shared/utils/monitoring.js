const { createLogger, format, transports } = require("winston");
const WinstonCloudWatch = require("winston-cloudwatch");
const EnvironmentVariablesManager = require('../services/EnvironmentVariablesManager');
const path = require('path');
const fs = require('fs');

class MetricsCollector {

    constructor(namespace) {
        this.namespace = namespace;
        this.environment = EnvironmentVariablesManager.getEnvVariable("LOGGING_ENVIRONMENT");
        this.isProduction = this.environment === 'production';
        
        const logGroupName = "/aws/ec2/conversion-reporting-metrics" + 
            (this.isProduction ? "" : `-${this.environment}`);
        
        this.logger = this.setupLogger(logGroupName);
    }

    setupLogger(logGroupName) {
        let logTransports = [];

        if (this.isProduction) {
            const today = new Date().toISOString().split("T")[0];
            logTransports.push(
                new WinstonCloudWatch({
                    awsRegion: "us-east-1",
                    logGroupName: logGroupName,
                    logStreamName: `${today}-${this.namespace}-metrics`,
                    jsonMessage: true,
                    createLogGroup: true,
                    createLogStream: true,
                })
            );
        } else {
            const logsDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir);
            }
            
            logTransports.push(new transports.File({
                filename: path.join(logsDir, `metrics-${this.namespace}.log`),
                format: format.combine(
                    format.timestamp(),
                    format.printf(info => {
                        const metricData = info[Symbol.for('splat')] ? info[Symbol.for('splat')][0] : info;
                        return `[${metricData.timestamp}] ${metricData.namespace} - ${metricData.metric}: ${metricData.value} ${metricData.unit}`;
                    })
                )
            }));
        }

        return createLogger({
            transports: logTransports
        });
    }

    startTimer(operationName) {
        const startTime = process.hrtime();
        
        return {
            end: () => {
                const [seconds, nanoseconds] = process.hrtime(startTime);
                const durationMs = (seconds * 1000) + (nanoseconds / 1000000);
                this.putMetric(`${operationName}Duration`, durationMs, 'Milliseconds');
                return durationMs;
            }
        };
    }

    incrementCounter(metricName, value = 1) {
        this.putMetric(metricName, value, 'Count');
    }

    async putMetric(metricName, value, unit) {
        if (value === undefined || isNaN(value)) {
            this.logger.warn(`Invalid metric value for ${metricName}`);
            return;
        }

        this.logger.info(`metric`, {
            timestamp: new Date().toISOString(),
            metric: metricName,
            value: value,
            unit: unit,
            namespace: this.namespace,
            environment: this.environment
        });
    }

    recordBatchSize(size) {
        this.putMetric('BatchSize', size, 'Count');
    }

    recordProcessingErrors(count = 1) {
        this.putMetric('ProcessingErrors', count, 'Count');
    }

    recordConversionCount(count, type = 'total') {
        this.putMetric(`Conversions_${type}`, count, 'Count');
    }
}

class OperationTracker {

    constructor(metricsCollector, operationName) {
        this.metricsCollector = metricsCollector;
        this.operationName = operationName;
    }

    async track(operation) {
        const timer = this.metricsCollector.startTimer(this.operationName);
        try {
            const result = await operation();
            this.metricsCollector.incrementCounter(`${this.operationName}_success`);
            return result;
        } catch (error) {
            this.metricsCollector.incrementCounter(`${this.operationName}_failure`);
            throw error;
        } finally {
            timer.end();
        }
    }
}

module.exports = {
    MetricsCollector,
    OperationTracker
};