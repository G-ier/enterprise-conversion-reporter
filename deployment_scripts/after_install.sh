#!/bin/bash

cd /var/www/efflux-conversion-reporting-solution
if [ -f package-lock.json ]; then
    rm -f package-lock.json
    npm install
fi
