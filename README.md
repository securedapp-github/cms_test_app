# SecureDApp CMS

Run `npm run demo:install` then `npm run demo:all` from root


Frontend App (UI): Running on http://localhost:5175 (demo-apps/unified-demo/frontend).

Backend Proxy App (API): Running on http://localhost:5050 (demo-apps/unified-demo/backend).


For mTLS: enable CMS_MTLS_ENABLED in backend env and add client.crt and client.key

For generating CSR steps: 

        Generate key pair: 
        openssl ecparam -name prime256v1 -genkey -noout -out client.key
                
        openssl req -new \
        -key client.key \
        -out client.csr \
        -subj "/C=IN/O=YOUR-ORG-NAME/CN=ORG-CMS-ID"

        // ORG-CMS-ID can be found in Fiduciary Dashboard : Profile section

        Check CSR: openssl req -in client.csr -text -noout