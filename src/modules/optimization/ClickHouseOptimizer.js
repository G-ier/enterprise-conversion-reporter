// Local imports
const ClickHouseService = require('../../shared/lib/ClickHouseService');
const { OptimizationLogger } = require('../../shared/utils/logger');

class ClickHouseOptimizer {
  /**
   * Constructor for ClickHouseOptimizer.
   */
  constructor() {
    this.clickHouseService = new ClickHouseService();
  }

  /**
   * Runs the OPTIMIZE TABLE command on the specified table.
   * @param {string} tableName - The name of the table to optimize.
   * @returns {Promise<void>}
   */
  async optimizeTable(tableName) {
    try {
      OptimizationLogger.info(`Starting optimization for table: ${tableName}`);
      await this.clickHouseService.query(`OPTIMIZE TABLE ${tableName} FINAL`);
      OptimizationLogger.info(`Optimization completed for table: ${tableName}`);
    } catch (error) {
      OptimizationLogger.error(`Error optimizing table ${tableName}: ${error}`);
    }
  }
}

module.exports = ClickHouseOptimizer;