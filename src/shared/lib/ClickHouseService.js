// Third Party Imports
const _ = require("lodash");

// Local Application Imports
const { ServerLogger } = require("../utils/logger");
const ClickhouseConnection = require("./ClickhouseConnection");

const processString = (value) => {
  if (typeof value === "string" && value !== null) {
    return `'${value}'`;
  }
  return value;
};

class ClickHouseService {

  constructor() {
    this.connection = new ClickhouseConnection().getConnection();
  }

  async query(query) {
    try {
      const resultSet = await this.connection.query({
        query: query,
        format: "JSONEachRow",
      });

      // Check if the query is a DDL statement
      if (query.trim().toUpperCase().startsWith('OPTIMIZE')) {
        // For DDL statements, there might not be a result set
        return;
      }

      const dataset = await resultSet.json();
      return dataset;
    } catch (error) {
      console.error(`❌ Error querying Clickhouse: ${error}`);
      ServerLogger.error(`🚨 Error executing Clickhouse query: ${error}`);
      throw error;
    }
  }

  async insert(table, values) {
    try {
      const result = await this.connection.insert({
        table: table,
        values: values,
        format: "JSONEachRow",
      });
      return result;
    } catch (error) {
      console.error(`❌ Error inserting data on Clickhouse: ${error}`);
      ClickhouseLogger.error(`🚨 Error executing Clickhouse insert: ${error}`);
      throw error;
    }
  }

  async delete(tableName, condition) {
    try {
      if (!condition || Object.keys(condition).length === 0) {
        throw new Error("Delete operation requires a condition to avoid accidental data loss.");
      }

      const conditionString = Object.entries(condition)
        .map(([key, value]) => {
          if (typeof value === "string") {
            return `${key} = ${processString(value)}`;
          } else if (typeof value === "number") {
            return `${key} = ${value}`;
          } else if (Array.isArray(value)) {
            const valueList = value.map((item) => (typeof item === "string" ? `'${item}'` : item)).join(", ");
            return `${key} IN (${valueList})`;
          } else if (typeof value === "object") {
            // Handling comparative conditions
            const comparativeConditions = [];
            if ("gt" in value) {
              comparativeConditions.push(`${key} > ${processString(value.gt)}`);
            }
            if ("lt" in value) {
              comparativeConditions.push(`${key} < ${processString(value.lt)}`);
            }
            if ("gte" in value) {
              comparativeConditions.push(`${key} >= ${processString(value.gte)}`);
            }
            if ("lte" in value) {
              comparativeConditions.push(`${key} <= ${processString(value.lte)}`);
            }
            return comparativeConditions.join(" AND ");
          } else {
            throw new Error(`Unsupported condition type for key: ${key}`);
          }
        })
        .join(" AND ");

      const deleteQuery = `ALTER TABLE ${tableName} DELETE WHERE ${conditionString};`;
      console.log("🚀 Executing delete query:", deleteQuery);

      // Execute the DELETE query
      const result = await this.query(deleteQuery);
      return result;
    } catch (error) {
      console.error(`❌ Error deleting data from table ${tableName}: ${error}`);
      ClickhouseLogger.error(`🚨 Error executing Clickhouse delete: ${error}`);
      throw error;
    }
  }

  async dynamicQuery(tableName, fields = ["*"], filters = {}, limit, joins = []) {
    try {
      // Begin building the query string
      let queryString = `SELECT ${fields.join(", ")} FROM ${tableName}`;

      // Handling joins (adjust based on ClickHouse JOIN capabilities)
      for (const join of joins) {
        queryString += ` ${join.type.toUpperCase()} JOIN ${join.table} ON ${join.first} ${join.operator} ${
          join.second
        }`;
      }

      // Apply filters to the query string
      const filterConditions = Object.entries(filters)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            const statement = `${key} IN (${value.map((i) => processString(i)).join(", ")})`;
            return statement;
          } else if (typeof value === "string" && value !== null) {
            return `${key} = ${processString(value)}`;
          } else if (typeof value === "object" && value !== null) {
            // Handle special filter conditions like greater than, less than, etc.
            const conditions = [];
            if (value.gt !== undefined) {
              conditions.push(`${key} > ${processString(value.gt)}`);
            }
            if (value.lt !== undefined) {
              conditions.push(`${key} < ${processString(value.lt)}`);
            }
            if (value.gte !== undefined) {
              conditions.push(`${key} >= ${processString(value.gte)}`);
            }
            if (value.lte !== undefined) {
              conditions.push(`${key} <= ${processString(value.lte)}`);
            }
            return conditions.join(" AND ");
          } else {
            // Default case for direct equality
            return `${key} = ${processString(value)}`;
          }
        })
        .join(" AND ");

      if (filters && Object.keys(filters).length > 0) {
        queryString += ` WHERE ${filterConditions}`;
      }

      if (limit) {
        queryString += ` LIMIT ${limit}`;
      }

      // Execute the query
      const results = await this.query(queryString);
      return results;
    } catch (error) {
      console.error(`❌ Error querying table ${tableName}`, error);
      throw error;
    }
  }

}

module.exports = ClickHouseService;