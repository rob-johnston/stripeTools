const testing = require('./index.js')
//tests and examples

(async function() {

    //get applicationFees between 2 dates
    const appFees = await testing.getBetweenDates({
        resource: 'applicationFees',
        startDate: '2018-03-07',
        endDate: '2018-03-10'
    });

    //resolve the charges onto these application fees
    const resolved = await testing.populateStripeResource({collection : appFees, targetResource : 'charges', foreignKey : 'originating_transaction'});

    console.log(resolved);
})();