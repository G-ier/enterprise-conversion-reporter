#!/bin/bash

cd /var/www/efflux-conversion-reporting
if [ -f package-lock.json ]
then
    rm -f package-lock.json
fi
npm install
