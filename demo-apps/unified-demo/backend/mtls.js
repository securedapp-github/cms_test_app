const https = require('https');
const fs = require('fs');

const req = https.request(
    'https://cmsbe.securedapp.io/public/purposes',
    {
        method: 'GET',
        key: fs.readFileSync('./certs/client.key'),
        cert: fs.readFileSync('./certs/client.crt'),
        rejectUnauthorized: true,
        headers: {
            'x-api-key': ""
        }
    },
    (res) => {
        console.log('STATUS:', res.statusCode);

        let data = '';

        res.on('data', chunk => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('BODY:', data);
        });
    }
);

req.on('error', err => {
    console.error('HTTPS ERROR:', err);
});

req.end();