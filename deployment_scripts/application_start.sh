#!/bin/bash

cd /var/www/efflux-conversion-reporting

# get the environment from the environment variable passed from the CodePipeline
# this will be either staging, production, cronus_staging or cronus_production
ENV=$1

# if the environment variable is not set, default to production
if [ -z "$ENV" ]
then
    ENV=production
fi

if [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js --env $ENV

    # Save the current process list so that it can be restored on reboot
    pm2 save
fi
