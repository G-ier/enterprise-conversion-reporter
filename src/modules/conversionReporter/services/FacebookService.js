// Third party imports
const _ = require('lodash');
const sha256 = require("js-sha256");
const axios = require('axios');
const { v4: uuidv4 } = require("uuid");

// Local application imports
const DatabaseRepository = require('../../../shared/lib/DatabaseRepository');
const { usStates } = require('../constants/usStates');
const camelCaseToSpaced = require('../utils/camelCaseToSpaced');
const { ConversionReporterLogger: logger } = require('../../../shared/utils/logger');
const { FB_API_URL } = require('../constants/fbConstants');

function generateEventId() {
    return uuidv4();
}

class FacebookService {

    constructor() {
      this.repository = new DatabaseRepository();
    }

    async getPixelsToken(pixelId) {

      const tableName = 'pixels';
      const fileds = ['ua.token'];
      const filters = { "pixels.code": pixelId };
      const joins = [
        {
          type: "inner",
          table: "pixels_ad_accounts_relations AS paar",
          first: "pixels.id",
          operator: "=",
          second: "paar.pixel_id"
        },
        {
          type: "inner",
          table: "ad_accounts AS aa",
          first: "paar.ad_account_id",
          operator: "=",
          second: "aa.id"
        },
        {
          type: "inner",
          table: "aa_prioritized_ua_map AS map",
          first: "aa.id",
          operator: "=",
          second: "map.aa_id",
        },
        {
          type: "inner",
          table: "user_accounts AS ua",
          first: "map.ua_id",
          operator: "=",
          second: "ua.id"
        }
      ];
      const result = await this.repository.query(tableName, fileds, filters, null, joins);
      return result[0].token;
    }

    async postCapiEvents(token, pixel, data) {
      logger.info(`Sending ${data.data.length} events to Facebook CAPI for pixel ${pixel}`);
      const url = `${FB_API_URL}/${pixel}/events`;
      try {
        const response = await axios.post(
          url, 
          {
            data: data.data,
            access_token: token,
          }, 
          { 
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        console.log(response)
        return response;
      } catch (error) {
        logger.error(`Error posting events to Facebook CAPI: ${error}`);
        throw error;
      }
    }

    /**
     * Reports conversion data to Facebook's API.
     * @param {Array} conversions - Array of conversion objects to report
     * @returns {Promise<boolean>} True if reporting successful
     */
    async reportConversions(conversions) {

      // Step 1: Construct the payloads for the Facebook API, grouped by pixels.
      const pixelGroupedConversions = _.groupBy(conversions, "pixel_id");
      const fbProcessedPayloads = [];
      Object.entries(pixelGroupedConversions).forEach(([pixelId, events]) => {
        const fbCAPIPayloads = this.constructFacebookConversionEvents(events);
        fbProcessedPayloads.push({
          entityType: "pixel",
          entityId: pixelId,
          payloads: fbCAPIPayloads,
        });
      });

      logger.info(`Posting events to FB CAPI in batches.`);
      for (const batch of fbProcessedPayloads) {

        // Step 2: Fetch the access tokens for the pixels.
        const token = await this.getPixelsToken(batch.entityId);

        // Step 3: Report the conversions to the Facebook API.
        for (const payload of batch.payloads) {
          await this.postCapiEvents(token, batch.entityId, payload);
        }
      }
      logger.info(`All events posted to FB CAPI.`);
    }

    /**
     * Constructs Facebook conversion events payloads.
     * @param {Array} events - Array of conversion objects
     * @returns {Array} Array of Facebook conversion events payloads
     */
    constructFacebookConversionEvents(events) {

        const MAX_EVENTS = 1000;
    
        let payloads = [];
        let currentPayload = { data: [] };
    
        events.forEach((event) => {

            logger.debug(JSON.stringify({
                message: "Processing new conversion event",
                data: {
                    original_click_timestamp: event.click_timestamp,
                    original_region: event.region,
                    original_country_code: event.country_code
                }
            }, null, 2));

            const fbc = `fb.1.${event.click_timestamp * 1000}.${event.ts_click_id}`; 
            const fbp = `fb.1.${event.click_timestamp * 1000}.${generateEventId()}`;
            
            logger.debug(JSON.stringify({
                message: "Region transformation details",
                data: {
                    input_region: event.region,
                    camelcase_to_spaced: camelCaseToSpaced(event.region),
                    uppercase_region: camelCaseToSpaced(event.region).toUpperCase(),
                    mapped_us_state: event.country_code === "US" ? usStates[camelCaseToSpaced(event.region).toUpperCase()] : null
                }
            }, null, 2));

            const state = event.country_code === "US" && usStates[camelCaseToSpaced(event.region).toUpperCase()] !== undefined
                ? usStates[camelCaseToSpaced(event.region).toUpperCase()].toLowerCase()
                : event.region.toLowerCase().replace(" ", "");
    
            for (let i = 0; i < event.conversions; i++) {

                // If the current payload has reached the max number of events, push it to the payloads array and reset the current payload.
                if (currentPayload.data.length === MAX_EVENTS) {
                  payloads.push(currentPayload);
                  currentPayload = { data: [] };
                }
    
                const eventPayload = {
                  event_name: "Purchase",
                  event_time: Number(event.click_timestamp),
                  event_id: `${event.ts_click_id}-${i}-${generateEventId()}`,
                  action_source: "website",
                  user_data: {
                    country: [sha256(event.country_code.toLowerCase())],
                    client_ip_address: event.ip,
                    client_user_agent: event.user_agent,
                    ct: [sha256(event.city.toLowerCase().replace(" ", ""))],
                    fbc: fbc,
                    fbp: fbp,
                    st: [sha256(state)],
                  },
                  opt_out: false,
                  custom_data: {
                    currency: "USD",
                    value: `${event.revenue / event.conversions}`,
                    content_name: event.keyword_clicked,
                    content_type: event.vertical,
                    content_category: event.category,
                  },
                };
                currentPayload.data.push(eventPayload);

                const hashedData = {
                    country_hash: sha256(event.country_code.toLowerCase()),
                    city_hash: sha256(event.city.toLowerCase().replace(" ", "")),
                    state_hash: sha256(state)
                };

                logger.debug(JSON.stringify({
                    message: "Data transformation details",
                    data: {
                        original: {
                            country: event.country_code,
                            city: event.city,
                            state: state,
                            revenue: event.revenue,
                            conversions: event.conversions,
                            ip: event.ip,
                            user_agent: event.user_agent,
                            content_name: event.keyword_clicked,
                            content_type: event.vertical,
                            content_category: event.category
                        },
                        transformed: {
                            country_lowercase: event.country_code.toLowerCase(),
                            city_transformed: event.city.toLowerCase().replace(" ", ""),
                            state_transformed: state,
                            revenue_per_conversion: event.revenue / event.conversions,
                            ip: event.ip,
                            user_agent: event.user_agent,
                            content_name: event.keyword_clicked,
                            content_type: event.vertical,
                            content_category: event.category
                        },
                        hashed: hashedData
                    }
                }, null, 2));

                logger.debug(JSON.stringify({
                    message: "Facebook conversion payload details",
                    data: {
                        facebook_ids: {
                            fbc: fbc,
                            fbp: fbp,
                            event_id: `${event.ts_click_id}-${i}-${generateEventId()}`
                        },
                        batch_status: {
                            current_batch_size: currentPayload.data.length,
                            total_batches: payloads.length,
                            max_batch_size: MAX_EVENTS
                        }
                    }
                }, null, 2));
            }
        });
    
        // Add the last payload if it has any events
        if (currentPayload.data.length > 0) {
          payloads.push(currentPayload);
        }
    
        return payloads;
    }

}


module.exports = FacebookService;