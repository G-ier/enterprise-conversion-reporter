#!/bin/bash

# get the environment from the environment variable passed from the CodePipeline
# this will be either staging, production, cronus_staging or cronus_production
ENV=$1

# if the environment variable is not set, default to production
if [ -z "$ENV" ]
then
    ENV=production
fi

cd /var/www/efflux-conversion-reporting-solution

if [ -f "ecosystem.config.js" ]
then
  pm2 stop ecosystem.config.js --env $ENV
else
    echo "ecosystem.config.js does not exist"
fi
