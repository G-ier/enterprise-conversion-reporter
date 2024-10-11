#!/bin/bash

# get the environment from the environment variable passed from the CodePipeline
# this will be either staging, production, cronus_staging or cronus_production
ENV=$1

echo "Stopping application"