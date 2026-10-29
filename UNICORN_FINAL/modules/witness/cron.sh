#!/bin/bash
# Not installed in crontab. Enable only after GSC_CLIENT_ID, GSC_CLIENT_SECRET,
# GSC_REFRESH_TOKEN, and GSC_SITE_URL return real rows.
curl -s -X POST https://zeusai.pro/witness/sync -H "Authorization: Bearer ${WITNESS_SYNC_TOKEN}"
