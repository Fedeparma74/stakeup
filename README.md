# stakeup

A tool that backups the Stakenet MCLW data (lnd channels included) before every start of the wallet. It zips the entire Stakenet data folder end encrypts it with a password chosen by the user. It then starts the MCLW and uploads the zip in an encrypted bucket on the Storj Decentralized Cloud Storage and also keeps the last copy in local. *(Linux support only as of now)*

If you want to test it download from the release or build from source. Then create a free account on <https://www.storj.io/>, click **skip and go directly to the dashboard** -> **Access** -> **Create Access Grant** -> keep all the access permissions -> choose **Continue in CLI** and put the generated *Satellite Address* and *API Key* in the ```config.json``` file. In the ```config.json``` file choose also a bucket name of your choice, the encryption passwords for the bucket and for the zip file to upload, and choose a number of the latest backup copies to keep remotely on Storj DCS. Then put the binary and ```config.json``` files in your Stakenet MCLW folder and execute ```./stakeup-linux```.

## Build from source

To build from source you need:
- Node.js
- pkg
- make
- gcc
- go

### Commands

```
git clone https://github.com/Fedeparma74/stakeup
cd stakeup
yarn && yarn install
pkg stakeup.js -c package.json
```
