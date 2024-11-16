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

/**
 * Generates a unique event ID using UUID v4
 * @returns {string} A unique UUID v4 string
 */
function generateEventId() {
    return uuidv4();
}

class FacebookService {

    constructor() {
      this.repository = new DatabaseRepository();
    }

    /**
     * Retrieves the access token for a given Facebook pixel ID
     * @param {string} pixelId - The Facebook pixel ID
     * @returns {Promise<string>} The access token associated with the pixel
     */
    // TODO: This method returns a token, but the fact that the pixel can be of different bm-s is concerning to me. Keep an eye on this.
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

    /**
     * Posts conversion events to Facebook's Conversion API
     * @param {string} token - The Facebook access token
     * @param {string} pixel - The Facebook pixel ID
     * @param {Object} data - The event data to send
     * @param {Array} data.data - Array of event objects
     * @returns {Promise<Object>} The Facebook API response
     * @throws {Error} If the API request fails
     */
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
        return response.data;
      } catch (error) {
        logger.error(`Error posting events to Facebook CAPI: ${error}`);
        throw error;
      }
    }

    /**
     * Reports conversion data to Facebook's API.
     * @param {Array} conversions - Array of conversion objects to report
     * @returns {Promise<Object>} Object containing successes and failures
     */
    async reportConversions(conversions) {

        const successes = [];
        const failures = [];

        // Group conversions by pixel ID
        const pixelGroupedConversions = _.groupBy(conversions, "pixel_id");

        for (const [pixelId, events] of Object.entries(pixelGroupedConversions)) {

            // Construct the Facebook conversion events payloads
            const fbCAPIPayloads = this.constructFacebookConversionEvents(events);

            // Fetch the access token for the pixel
            const token = await this.getPixelsToken(pixelId);

            for (const payload of fbCAPIPayloads) {
                try {
                    // Post the Facebook conversion events payload to the CAPI
                    await this.postCapiEvents(token, pixelId, { data: payload.data });
                    
                    // Mark events in this payload as successful
                    successes.push(...payload.events);
                } catch (error) {
                    // Mark events in this payload as failed
                    failures.push(...payload.events);
                    logger.error(`Error reporting to Facebook for pixel ${pixelId}:`, error);
                }
            }
        }
        return { successes, failures };
    }

    /**
     * Constructs Facebook conversion events payloads.
     * @param {Array} events - Array of conversion objects
     * @returns {Array} Array of Facebook conversion events payloads
     */
    constructFacebookConversionEvents(events) {

        const MAX_EVENTS = 1000;
        const payloads = [];
        let currentPayloadData = [];
        let currentPayloadEvents = [];

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
                currentPayloadData.push(eventPayload);

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
                            current_batch_size: currentPayloadData.length,
                            total_batches: payloads.length,
                            max_batch_size: MAX_EVENTS
                        }
                    }
                }, null, 2));
            }
            currentPayloadEvents.push(event);
            
            // If the current payload has reached the max number of events, push it to the payloads array and reset the current payload.
            if (currentPayloadData.length === MAX_EVENTS) {
                payloads.push({
                    data: currentPayloadData,
                    events: currentPayloadEvents
                });
                currentPayloadData = [];
                currentPayloadEvents = [];
            }
        });

        // Add the last payload if it has any events
        if (currentPayloadData.length > 0) {
            payloads.push({
                data: currentPayloadData,
                events: currentPayloadEvents
            });
        }

        return payloads;
    }
}


module.exports = FacebookService;