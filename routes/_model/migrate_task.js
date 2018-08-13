const { DateTime } = require('luxon');
const _ = require('underscore')


let friendlyLoop = (data, initResult,work) => {
  return new Promise((resolve,reject) => {
    const maxIdx = data.length - 1;
    let results = initResult;
    let worker = (idx,done) => {
      results = work(idx,data[idx],results);
      if (idx == maxIdx) {
        done(results);
        return;
      }
      setImmediate(worker.bind(null, idx+1, done));
    };
    worker(0,resolve);
  });
};

class MigrateTask {
  constructor(description, influx) {
    console.log("Migrate task created")
    this.guid = description.guid;
    this.summary ={
      done: false,
      status : "",
      fromChannel : "",
      toChannel : "",
      chunks: [],
      resultsData: []
    }
    this.summary.status = "Processing ..."
    this.summary.fromChannel = description.fromChannel
    this.summary.toChannel = description.toChannel
    this.promise = Promise.resolve(this.summary)
    .then((d) => this.createChunksForMigration(d, influx)) // create a chunk array which has start and end dates
    .then((d) => this.beginMigration(d, influx)) // use the chunk array created in previous step and export each month data into CSV

    // this.promise = Promise.resolve(summary)
    // .then((d) => this.generateChunks(d))
    // .then((d) => this.exportQuery(d, influx))
    // .then((fileContents) => this.writeFile(fileContents))
    // .catch((err) => {
    //     this.summary = {
    //       done: true,
    //       status: err,
    //     };
    //   });
  }

  createChunksForMigration(summary, influx) {
    //get the first date and last date of the channel from which we want to migrate
    return new Promise((resolve, reject) => {
      let fromChannel = summary.fromChannel
      let startDate = ""
      let endDate = ""
      let out_dates = []
      let getFirstDateInflux = `select * from ${fromChannel.measurement} where site = '${fromChannel.site}' and generator = '${fromChannel.generator}'
      and method = '${fromChannel.method}' and location = '${fromChannel.location}' and number='${fromChannel.number}' and units = '${fromChannel.units}'
      limit 1`

      let getEndDateInflux = `select * from ${fromChannel.measurement} where site = '${fromChannel.site}' and generator = '${fromChannel.generator}'
      and method = '${fromChannel.method}' and location = '${fromChannel.location}' and number='${fromChannel.number}' and units = '${fromChannel.units}'
      order by time desc limit 1`

      Promise.all([influx.query(getFirstDateInflux), influx.query(getEndDateInflux)]).then((values) => {
        startDate = values[0]
        endDate = values[1]
        endDate = DateTime.fromISO(endDate[0].time._nanoISO, {zone: 'utc'}).plus({months: 1}) // add one month to the end to make it complete
        let chunkStart = DateTime.fromISO(startDate[0].time._nanoISO, {zone: 'utc'}).set({day:1, hour:0, minute:0, seconds:0})
        let chunkEnd = chunkStart.plus({months:1})
        do {
          out_dates.push({
            start: chunkStart,
            end: chunkEnd
          });
          chunkStart = chunkEnd;
          chunkEnd = chunkEnd.plus({months:1})
        } while(chunkEnd.valueOf() <= endDate.valueOf())
        summary.chunks = out_dates
        resolve(summary)
      })
    })
  }

  beginMigration(summary, influx) {
    return new Promise((resolve, reject) => {
      // here create a promise which calls export task and import task for each month ?
      // console.log("calling begin migration")

      let fromChannel = summary.fromChannel
      let toChannel = summary.toChannel
      let tags = _.omit(toChannel, 'measurement')
      let migrateDataPromise = []

      console.log(tags)
      let chunks = summary.chunks
      _.each(chunks, (chunk) => {
        let startDate = chunk['start']
        let endDate = chunk['end']
        let q = `select value from "${fromChannel.measurement}"
        where site = '${fromChannel.site}' and generator = '${fromChannel.generator}' and method = '${fromChannel.method}'
        and location = '${fromChannel.location}' and number='${fromChannel.number}' and units = '${fromChannel.units}'
        and time >= '${startDate}' and time <= '${endDate}'group by *`;
        
        summary.currentQuery = q
        let readPromise = influx.query(q)
        readPromise.then((resultData) => {
          let writePromise = new Promise((writeResolve, writeReject) => {
            // write a friendly loop to display data
            let finishMigrate = friendlyLoop(resultData, [], (idx, row, result) => {
              result.push(row.time)
              return result
            })
            finishMigrate.then(textRows => {
              summary.resultsData.push(textRows)
            })
          })
        })
      })
      resolve()
    })
  }
  // testLargePromise(d) {
  //   return new Promise((resolve, reject) => {
  //     let wait = setTimeout(() => {
  //       d.status = 'Complete'
  //       clearTimeout(wait);
  //       resolve('Promise A win!');
  //     }, 10000)
  //   })
  // }

}
module.exports = MigrateTask;
