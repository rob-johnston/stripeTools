const { last } = require('lodash');
const moment = require('moment');
let stripe;

module.exports = function (key) {

    stripe = require('stripe')(key);

    return Object.assign({}, {
        getBetweenDates,
        populateStripeResource,
        stripe
    });
};


/* function for dealing with stripes pagination in order to retrieve
    results between two certain dates
 */
const getBetweenDates = async ({resource, startDate, endDate, result = [], stripeArgs = { limit : 100 } } ) => {

    try {

        const items = await stripe[resource].list(stripeArgs);
        result = result.concat(items.data);
        const lastCreated = moment.unix(last(result).created).format('YYYY-MM-DD');

        //fetch next round or recurse
        if(moment(lastCreated).isSameOrAfter(startDate)){
            const args = Object.assign(stripeArgs, { starting_after : last(result).id});
            return getBetweenDates({ resource, startDate, endDate, result, stripeArgs : args});
        } else {
            //sanitise dates and return
            return result.filter(x => moment(moment.unix(x.created).format('YYYY-MM-DD')).isSameOrAfter(startDate)
                && moment(moment.unix(x.created).format('YYYY-MM-DD')).isSameOrBefore(endDate));
        }
    } catch (error) {
        console.log(error);
    }
};

//resolve an associated stripe resource onto the items in a collection (using the stripe id) - eg resolve charges onto application fees
const populateStripeResource = async ({ collection, targetResource, foreignKey, as = targetResource }) => {

    try {
        return await Promise.all(collection.map(async x => {
            //get the item and map to collection
            const y = await stripe[targetResource].retrieve(x[foreignKey]);
            return Object.assign(x, {[as]: y});
        }));
    } catch (error) {
        console.log(error);
    }
};
