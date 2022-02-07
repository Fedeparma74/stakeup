const fs = require("fs");
const { exec } = require("child_process");
const storj = require("uplink-nodejs");
const libUplink = new storj.Uplink();

const archiver = require('archiver');
archiver.registerFormat('zip-encrypted', require("archiver-zip-encrypted"));

// read config file
const config = JSON.parse(fs.readFileSync('./config.json').toString());

const archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password: config.zipPassword });

(async () => {

    // storj login
    const access = await libUplink.requestAccessWithPassphrase(config.satellite, config.api, config.storjPassphrase)
        .catch((err) => {
            console.log(err);
        });

    console.log(access);

    // open storj project
    const project = await access.openProject()
        .catch((err) => {
            console.log(err);
        });

    console.log(project);

    // check if bucket is present
    const bucketstat = await project.statBucket(config.bucket)
        .catch(async (err) => {
            if (err.code == 19) { // no bucket with given name

                // create bucket
                const bucket = await project.createBucket(config.bucket)
                    .catch((err) => {
                        console.log(err);
                    });

                console.log(bucket);

                // ensure that the bucket has been created
                const ensbucket = await project.ensureBucket(config.bucket)
                    .catch((err) => {
                        console.log(err);
                    });

                console.log(ensbucket);
            }
        });

    console.log(bucketstat);

    // stakenet mclw data directory
    const localdir = process.env.LOCALAPPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share");

    const d = new Date;
    const date = d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0') + '_' + d.getHours().toString().padStart(2, '0') + '.' + d.getMinutes().toString().padStart(2, '0') + '.' + d.getSeconds().toString().padStart(2, '0');

    console.log(date);

    const zipname = "Stakenet_" + date + ".zip";

    // open stream for writing zip file
    const stream = fs.createWriteStream("./" + zipname);

    archive.on('error', function (err) {
        throw err;
    });

    console.log(localdir + "/Stakenet");

    archive.directory(localdir + "/Stakenet", false);
    archive.on('error', err => { throw err; });
    archive.pipe(stream);

    await archive.finalize();

    // zip has been written
    stream.on('close', async () => {
        console.log("Zip file created!");

        // remove old local backups
        await fs.promises.rm("./backup", { recursive: true })
            .then(() => {
                console.log("Backup deleted!");
            })
            .catch((err) => {
                if (err.code != "ENOENT") {
                    console.log(err);
                }
            });

        await fs.promises.mkdir("./backup", { recursive: true })
            .catch((err) => {
                console.log(err);
            });
        console.log("Backup folder created!");

        // move zip in ./backup folder
        await fs.promises.rename("./" + zipname, "./backup/" + zipname)
            .catch((err) => {
                console.log(err);
            });
        console.log("Backup moved!");

        // start MCLW
        console.log("Starting MCLW...");
        exec("./AppRun");

        const listObjectsOptions = new storj.ListObjectsOptions();
        const uploadOptions = new storj.UploadOptions();
        uploadOptions.expires = 0; // never expires

        // upload zip file on storj bucket
        await project.uploadObject(config.bucket, zipname, uploadOptions)
            .then(async (upload) => {

                const buffer = fs.readFileSync("./backup/" + zipname);

                console.log("Uploading ./backup/" + zipname);

                const written = await upload.write(buffer, buffer.length)
                    .catch((err) => {
                        console.log(err);
                    });

                console.log(written);

                await upload.commit().then(() => {
                    console.log("File uploaded!")
                }).catch((err) => {
                    console.log(err);
                });

            }).catch((err) => {
                console.log(err);
            });

        // list objects in bucket
        await project.listObjects(config.bucket, listObjectsOptions)
            .then(async (objectlist) => {
                console.log(objectlist);

                let backupArray = [];

                // create an array with the backups name and sort it alphabetically (oldest backup first)
                for (let i = 0; objectlist[i] != undefined; i++) {
                    if (objectlist[i].key.includes("Stakenet")) {
                        backupArray.push(objectlist[i].key);
                    }
                }

                backupArray.sort();

                // delete remote old backups from bucket if the number of copies exceeds the requested ones
                while (backupArray.length > config.maxCopies) {
                    await project.deleteObject(config.bucket, backupArray[0])
                        .then((objectinfo) => {
                            console.log("Deleted: " + objectinfo);
                            backupArray.shift();
                        }).catch((err) => {
                            console.log(err);
                        });
                }
            }).catch((err) => {
                console.log(err);
            });
    });
})();



