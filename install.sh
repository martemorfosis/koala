#!/bin/bash

cd `dirname $0`/src
npm install
patch -d node_modules/less/lib/less/ < ../less_parser.patch
exit 0
