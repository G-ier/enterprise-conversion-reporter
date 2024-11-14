const DatabaseConnection = require("./DatabaseConnection");

class DatabaseRepository {

  constructor() {}

  getConnection() {
    return DatabaseConnection.getConnection();
  }

  async query(tableName, fields = ["*"], filters = {}, limit, joins = []) {
    try {
      const connection = this.getConnection();
      let queryBuilder = connection(tableName).select(fields);

      // Handling joins
      for (const join of joins) {
        if (join.type === "inner") {
          queryBuilder = queryBuilder.join(join.table, join.first, join.operator, join.second);
        } else if (join.type === "left") {
          queryBuilder = queryBuilder.leftJoin(join.table, join.first, join.operator, join.second);
        }
      }

      // Apply filters to the query
      for (const [key, value] of Object.entries(filters)) {
        if (Array.isArray(value)) {
          queryBuilder = queryBuilder.whereIn(key, value);
        } else if (typeof value === "object" && value !== null) {
          // Handle special filter conditions like greater than, less than, etc.
          if (value.gt !== undefined) {
            queryBuilder = queryBuilder.where(key, ">", value.gt);
          }
          if (value.lt !== undefined) {
            queryBuilder = queryBuilder.where(key, "<", value.lt);
          }
          if (value.gte !== undefined) {
            queryBuilder = queryBuilder.where(key, ">=", value.gte);
          }
          if (value.lte !== undefined) {
            queryBuilder = queryBuilder.where(key, "<=", value.lte);
          }
          // Handle ILIKE condition
          if (value.ilike !== undefined) {
            queryBuilder = queryBuilder.where(key, 'ILIKE', value.ilike);
          }
          // Add more conditions as needed
        } else {
          // Default case for direct equality
          queryBuilder = queryBuilder.where(key, value);
        }
      }

      if (limit) queryBuilder = queryBuilder.limit(limit);

      const results = await queryBuilder;

      return results;
    } catch (error) {
      console.error(`❌ Error querying table ${tableName}`, error);
      throw error;
    }
  }

  // never used BUT IMPLEMENTATION PROBABLY NECCESSARY FOR THE FUTURE
  async raw(query, type = "read") {
    try {
      const connection = this.getConnection(type);
      return await connection.raw(query);
    } catch (error) {
      console.error("❌ Error executing raw query: ", error);
      throw error;
    }
  }

}

module.exports = DatabaseRepository;
