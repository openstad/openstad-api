
var log     = require('debug')('app:cron');
var db      = require('../db');

// Purpose
// -------
// Auto-close ideas that passed the deadline.
// 
// Runs every night at 4:00.
module.exports = {
	cronTime: '0 0 4 * * *',
	runOnInit: true,
	onTick: function() {
		Promise.all([
			db.Vote.anonymizeOldVotes(),
			db.ArgumentVote.anonymizeOldVotes()
		])
		.then(function([ voteResult, argVoteResult ]) {
			if( voteResult && voteResult.affectedRows ) {
				log(`anonymized votes: ${voteResult.affectedRows}`);
			}
			if( argVoteResult && argVoteResult.affectedRows ) {
				log(`anonymized argument votes: ${argVoteResult.affectedRows}`);
			}
		});
	}
};
