const { last, find, uniqBy, get } = require('lodash');
const moment = require('moment');
let stripe;

module.exports = function (key) {

    stripe = require('stripe')(key);

    return Object.assign({}, {
        getBetweenDates,
        populateStripeResource,
        safeRefund,
        multiList,
        stripe
    });
};


/* function for dealing with stripes pagination in order to retrieve
    results between two certain dates
 */
const getBetweenDates = async ({resource, startDate, endDate, result = [], stripeArgs = { limit : 20 }, connectedAccount = {}, failsafe = {}} ) => {

    //final steps before returning a result
    const finalize = result => {
        //to check each result is between acceptable date range
        const sanitizeDates = x => {
            return moment(moment.unix(x.created).format('YYYY-MM-DD').toString()).isSameOrAfter(startDate)
                && moment(moment.unix(x.created).format('YYYY-MM-DD').toString()).isSameOrBefore(endDate);
        };

        //return unique property
        const unique = x => {
            return x.id;
        };

        //sanitise dates and return
        result = result.filter(sanitizeDates);

        //remove duplicates
        return uniqBy(result, unique);
    }

    try {
        //gathering the data

        let items;

        if(!connectAccount) {
            items = await stripe[resource].list(stripeArgs);
        } else {
            items = await stripe[resource].list(stripeArgs, connectedAccount)
        }

        //use a failsafe in case we get to end of data without reaching our date target
        if(get(failsafe, 'id') === last(items.data)){
            return finalize(result);
        }

        result = result.concat(items.data);
        const lastCreated = moment.unix(last(result).created).format('YYYY-MM-DD');

        //fetch next round or recurse
        if(moment(lastCreated).isSameOrAfter(startDate)){
            const args = Object.assign(stripeArgs, { starting_after : last(result).id});
            return getBetweenDates({ resource, startDate, endDate, result, stripeArgs : args, connectedAccount : connectedAccount, failsafe : last(result).id });

        } else {

            //clean data and return it
            return finalize(result);
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

    const resources = await stripe[resource].list(stripeArgs);
    result = result.concat(resources.data);

    if(result.length >= customLimit){
        return result.slice(0, result.length - (Math.abs(result.length-customLimit)));
    } else {
        const args = Object.assign(stripeArgs, { starting_after : last(result).id});
        return multiList({resource, result, customLimit, args})
    }
};