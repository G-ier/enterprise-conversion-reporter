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
    async reportConversions(conversions, network) {

        const successes = [];
        const failures = [];

        // Group conversions by pixel ID
        const pixelGroupedConversions = _.groupBy(conversions, "pixel_id");

        for (const [pixelId, events] of Object.entries(pixelGroupedConversions)) {

            // Construct the Facebook conversion events payloads
            const fbCAPIPayloads = this.constructEventsForFacebook(events, network);

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
     * @param {string} network - Network type ('tonic' or 'crossroads')
     * @returns {Array} Array of Facebook conversion events payloads
     */
    constructEventsForFacebook(events, network) {
        const MAX_EVENTS = 1000;
        const payloads = [];
        let currentPayloadData = [];
        let currentPayloadEvents = [];

        events.forEach((event) => {

            // Generate identifiers
            const fbc = `fb.1.${event.click_timestamp * 1000}.${event.ts_click_id}`; 
            const fbp = `fb.1.${event.click_timestamp * 1000}.${generateEventId()}`;

            // Transform state
            const state = this.transformState(event);

            // Create common user data
            const userData = this.createUserData(event, fbc, fbp, state);

            // Function to add payload and check batch size
            const addPayload = (payload, event) => {
                currentPayloadData.push(payload);
                currentPayloadEvents.push(event);
                if (currentPayloadData.length >= MAX_EVENTS) {
                    payloads.push({
                        data: currentPayloadData,
                        events: currentPayloadEvents,
                    });
                    currentPayloadData = [];
                    currentPayloadEvents = [];
                }
            };

            if (network === "tonic") {

                // Add 'Page View' payload
                const pageViewPayload = this.createPayload(
                    "Page View",
                    event,
                    userData,
                    {},
                    0
                );
                addPayload(pageViewPayload, event);

                // Add 'View content' payload
                const viewContentPayload = this.createPayload(
                    "View content",
                    event,
                    userData,
                    { content_name: event.keyword_clicked },
                    0
                );
                addPayload(viewContentPayload, event);

            } else if (network === "crossroads") {
                
                // Add 'Page View' payloads
                for (let i = 0; i < event.lander_visitors; i++) {
                    const pageViewPayload = this.createPayload(
                        "Page View",
                        event,
                        userData,
                        {},
                        i
                    );
                    addPayload(pageViewPayload, event);
                }

                // Add 'View content' payloads
                for (let i = 0; i < event.lander_searches; i++) {
                    const viewContentPayload = this.createPayload(
                        "View content",
                        event,
                        userData,
                        { content_name: event.keyword_clicked },
                        i
                    );
                    addPayload(viewContentPayload, event);
                }
            }

            // Add 'Purchase' payloads
            for (let i = 0; i < event.conversions; i++) {
                const purchasePayload = this.createPayload(
                    "Purchase",
                    event,
                    userData,
                    {
                        currency: "USD",
                        value: `${event.revenue / event.conversions}`,
                        content_name: event.keyword_clicked,
                    },
                    i
                );
                addPayload(purchasePayload, event);
            }
        });

        // Push any remaining payloads
        if (currentPayloadData.length > 0) {
            payloads.push({
                data: currentPayloadData,
                events: currentPayloadEvents,
            });
        }

        return payloads;
    }

    /**
     * Creates a payload for an event.
     * @param {string} eventName - Name of the event ('Page View', 'View content', 'Purchase')
     * @param {Object} event - The event object
     * @param {Object} userData - User data object
     * @param {Object} customDataOverrides - Overrides for custom data
     * @param {number} iteration - Iteration index for event_id uniqueness
     * @returns {Object} Event payload
     */
    createPayload(eventName, event, userData, customDataOverrides, iteration) {
        return {
            event_name: eventName,
            event_time: Number(event.click_timestamp),
            event_id: `${event.ts_click_id}-${iteration}-${generateEventId()}`,
            action_source: "website",
            user_data: userData,
            opt_out: false,
            custom_data: {
                content_type: event.vertical,
                content_category: event.category,
                ...customDataOverrides,
            },
        };
    }

    /**
     * Creates user data for the payload.
     * @param {Object} event - The event object
     * @param {string} fbc - Facebook click ID
     * @param {string} fbp - Facebook browser ID
     * @param {string} state - Transformed state
     * @returns {Object} User data object
     */
    createUserData(event, fbc, fbp, state) {
        return {
            country: [sha256(event.country_code.toLowerCase())],
            client_ip_address: event.ip,
            client_user_agent: event.user_agent,
            ct: [sha256(event.city.toLowerCase().replace(" ", ""))],
            fbc: fbc,
            fbp: fbp,
            st: [sha256(state)],
        };
    }

    /**
     * Transforms the state information.
     * @param {Object} event - The event object
     * @returns {string} Transformed state
     */
    transformState(event) {
        if (event.country_code === "US") {
            const region = camelCaseToSpaced(event.region).toUpperCase();
            const usState = usStates[region];
            if (usState) {
                return usState.toLowerCase();
            }
        }
        return event.region.toLowerCase().replace(" ", "");
    }
}


module.exports = FacebookService;