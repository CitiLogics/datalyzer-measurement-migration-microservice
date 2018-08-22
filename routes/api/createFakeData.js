const moment = require('moment');
const fs = require('fs');

export function get(req, res, next) {
  let startDate = moment()
  console.log(new Date() + "/api/creteFakeData")

  console.log(startDate)
  startDate = startDate.subtract(8, 'months')

  let file = fs.createWriteStream('mydata.txt')
  let tempDate = startDate.month() + 8
  do {
      file.write("level,"+ "site=CSO-002,generator=scada,units=in,method=mousehouse,location=upstream,number=1"+ " value="+ Math.random() + " "+startDate.unix() + '\n')
      startDate = startDate.add(30, 'minutes')
  } while(startDate.month() <= tempDate)

  file.on('finish', () => {
      console.log('wrote all data to file');
  });
  file.end()
  res.sendStatus(200)
}
