const fs     = require('fs');
const moment = require('moment')
const {exec} = require('child_process');
const s3     = require('../services/awsS3');

const backupMongoDBToS3 = async () => {
  console.log('backing up to mongodb', process.env.S3_MONGO_BACKUPS);
  
  if (process.env.S3_MONGO_BACKUPS === 'ON') {
    const host            = process.env.MONGO_DB_HOST || 'localhost';
    const port            = process.env.MONGO_DB_PORT || 27017;
    const tmpDbFile       = 'db_mongo';
    const isOnK8s         = !!process.env.KUBERNETES_NAMESPACE;
    const namespace       = process.env.KUBERNETES_NAMESPACE;
    const bucket          = process.env.S3_BUCKET;
    const removeTmpDbFile = () => {
      try {
        console.log ('removing tmp db file', tmpDbFile);
        fs.unlinkSync(tmpDbFile);
      } catch (e) {
        console.error('error removing file', e);
      }
    };
    
    // Default command, does not considers username or password
    let command = `mongodump -h ${host} --port=${port} --archive=${tmpDbFile}`;
    
    
    exec(command, async (err, stdout, stderr) => {
      if (err) {
        // Most likely, mongodump isn't installed or isn't accessible
        console.error(`mongodump command error: ${err}`);
        removeTmpDbFile();
      } else {
        const created = moment().format('YYYY-MM-DD hh:mm:ss')
        
        const statsFile = fs.statSync(tmpDbFile);
        console.info(`file size: ${Math.round(statsFile.size / 1024 / 1024)}MB`);
        
        const fileNameInS3 = isOnK8s ? `mongodb/${namespace}/mongo_${created}` : `mongodb/mongo_${created}`;
        
        const s3Client = s3.getClient();
        
        //  Each part must be at least 5 MB in size, except the last part.
        let uploadId;
        try {
          const params = {
            Bucket: bucket,
            Key:    fileNameInS3,
            ACL:    "private"
          };
          const result = await s3Client.createMultipartUpload(params).promise();
          uploadId     = result.UploadId;
          console.info(`${fileNameInS3} multipart created with upload id: ${uploadId}`);
        } catch (e) {
          removeTmpDbFile();
          throw new Error(`Error creating S3 multipart. ${e.message}`);
        }
        
        const chunkSize  = 10 * 1024 * 1024; // 10MB
        const readStream = fs.createReadStream(tmpDbFile); // you can use a second parameter here with this option to read with a bigger chunk size than 64 KB: { highWaterMark: chunkSize }
        
        // read the file to upload using streams and upload part by part to S3
        const uploadPartsPromise = new Promise((resolve, reject) => {
          const multipartMap = {Parts: []};
          
          let partNumber       = 1;
          let chunkAccumulator = null;
          
          readStream.on('error', (err) => {
            reject(err);
          });
          
          readStream.on('data', (chunk) => {
            // it reads in chunks of 64KB. We accumulate them up to 10MB and then we send to S3
            if (chunkAccumulator === null) {
              chunkAccumulator = chunk;
            } else {
              chunkAccumulator = Buffer.concat([chunkAccumulator, chunk]);
            }
            if (chunkAccumulator.length > chunkSize) {
              // pause the stream to upload this chunk to S3
              readStream.pause();
              
              const chunkMB = chunkAccumulator.length / 1024 / 1024;
              
              const params = {
                Bucket:        bucket,
                Key:           fileNameInS3,
                PartNumber:    partNumber,
                UploadId:      uploadId,
                Body:          chunkAccumulator,
                ContentLength: chunkAccumulator.length,
              };
              s3Client.uploadPart(params).promise()
                .then((result) => {
                  console.info(`Data uploaded. Entity tag: ${result.ETag} Part: ${params.PartNumber} Size: ${chunkMB}`);
                  multipartMap.Parts.push({ETag: result.ETag, PartNumber: params.PartNumber});
                  partNumber++;
                  chunkAccumulator = null;
                  // resume to read the next chunk
                  readStream.resume();
                }).catch((err) => {
                  removeTmpDbFile();
                  console.error(`error uploading the chunk to S3 ${err.message}`);
                  reject(err);
              });
            }
          });
          
          /*readStream.on('end', () => {
            console.info('End of the stream');
          });*/
          
          readStream.on('close', () => {
            if (chunkAccumulator) {
              const chunkMB = chunkAccumulator.length / 1024 / 1024;
              
              // upload the last chunk
              const params = {
                Bucket:        bucket,
                Key:           fileNameInS3,
                PartNumber:    partNumber,
                UploadId:      uploadId,
                Body:          chunkAccumulator,
                ContentLength: chunkAccumulator.length,
              };
              
              s3Client.uploadPart(params).promise()
                .then((result) => {
                  console.info(`Last Data uploaded. Entity tag: ${result.ETag} Part: ${params.PartNumber} Size: ${chunkMB}`);
                  multipartMap.Parts.push({ETag: result.ETag, PartNumber: params.PartNumber});
                  chunkAccumulator = null;
                  resolve(multipartMap);
                }).catch((err) => {
                  removeTmpDbFile();
                  console.error(`error uploading the last chunk to S3 ${err.message}`);
                  reject(err);
              });
            }
          });
        });
        
        const multipartMap = await uploadPartsPromise;
        
        console.info(`All parts uploaded, completing multipart upload, parts: ${multipartMap.Parts.length} `);
        
        // gather all parts' tags and complete the upload
        try {
          const params = {
            Bucket:          bucket,
            Key:             fileNameInS3,
            MultipartUpload: multipartMap,
            UploadId:        uploadId,
          };
          const result = await s3Client.completeMultipartUpload(params).promise();
          console.info(`Upload multipart completed. Location: ${result.Location} Entity tag: ${result.ETag}`);
          removeTmpDbFile();
        } catch (e) {
          removeTmpDbFile();
          throw new Error(`Error completing S3 multipart. ${e.message}`);
        }
      }
    });
  }
}


/*
  ENV values needed:

  MONGO_DB_HOST
  S3_DBS_TO_BACKUP
  S3_ENDPOINT
  S3_KEY
  S3_SECRET
  S3_MYSQL_BUCKET
 */

module.exports = {
	cronTime: '0 0 1 * * *',
	runOnInit: true,
	onTick: async function() {
    backupMongoDBToS3();
	}
};
