const { last, find } = require('lodash');
const moment = require('moment');
let stripe;

module.exports = function (key) {

    stripe = require('stripe')(key);

    return Object.assign({}, {
        getBetweenDates,
        populateStripeResource,
        safeRefund,
        multList,
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


/* creates a stripe refund and reverses the associated transfer, but only if the account has enough money to cover the refund */
const safeRefund = async ({ chargeId, amount = 'full', refundApplicationFee = true, reverseTransfer = true, reason }) => {

    try {
        //get the initial charge
        const charge = await stripe.charges.retrieve(chargeId);

        //use full amount unless told otherwise
        if(amount === 'full') amount = charge.amount;

        //make sure its not already refunded
        if (charge.refunded) throw new Error(`Charge ${chargeId} has already been refunded`);

        //query balance of target account
        const balanceObject = await stripe.balance.retrieve({ stripe_account : charge.destination});

        //pick result with same currency as charge currency
        const balance = find(balanceObject.available, x => x.currency === charge.currency);

        //if balance is more than refund amount
        if(balance < amount) {
            throw new Error(`Balance of account ${charge.destination} is ${blance} ${charge.currency}, not enough to refund ${amount} for ${chargeId}`);
        }

        //create refund, reversing appFee and transfer
        const refund = await stripe.refunds.create({
                charge : chargeId,
                amount: amount,
                metadata: {
                    reason : reason
                },
                refund_application_fee: refundApplicationFee,
                reverse_transfer: reverseTransfer
            }
        );

        console.log(refund);

    } catch(error) {
        console.log(error);
    }
};

/*take a higher limit and recurse to get the results
 */
const multiList = async ({resource, result = [], customLimit = 500, stripeArgs = { limit : 100 }}) => {

    const results = await stripe[resource].list(stripeArgs);
    result = result.concat(results.data);

    if(result.length >= customLimit){
        return results.slice(0, result.length - (Math.abs(result.length-customLimit)));
    } else {
        const args = Object.assign(stripeArgs, { starting_after : last(result).id});
        return multiList({resource, result, customLimit, args})
    }
};