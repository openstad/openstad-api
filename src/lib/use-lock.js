const db	= require('../db');

let useLock = {};

useLock.executeLockedFunction = async function({ name, task }) {

  // use transactions
  let transaction = await db.sequelize.transaction();
  let lock;

  try {
    
    // create lock
    lock = await db.Lock.findOne({where: { type: name }})
    if (lock) {
      await transaction.rollback();
      return console.log(`LOCKED FUNCTION NOT RUNNING: ${ name } is locked`)
    } else {
      lock = await db.Lock.create({ type: name });
    }

    // execute task
    let error = await new Promise( task );
    if (error) throw error

    await lock.destroy();
    await transaction.commit();

  } catch(err) {
    if(lock) {
      await lock.destroy();
    }
  
    await transaction.rollback();
    console.log(`LOCKED FUNCTION FAILED: ${ name }`);
    console.log(err);
  }

}

useLock.createLockedExecutable = function({ name, task }) {

  return async function() {
    return useLock.executeLockedFunction({ name, task })
  }
}

module.exports = exports = useLock;
