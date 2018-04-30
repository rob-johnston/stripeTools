Some common operations we were doing with the stripe module.

PLEASE NOTE : This is a WIP module right now until a v2 is released.

How to use

```
npm install --save stripetools
```

then in your file

```
const stripetools = require('stripetools')('<PUT STRIPE KEY HERE>');
```

### getBetweenDates
Use to get results from stripe based on dates

Params
- resource : the name of the stripe resource you want to call. Eg 'charges' or 'applicationFees'
- startDate (format 'YYYY-MM-DD) the earliest date the results should be from
- endDate (format 'YYYY-MM-DD) the lastest date the results should be from

eg find all charges in March: 
```
const marchCharges = await stripetools.getBetweenDates({
    resource : 'charges',
    startDate : '2018-03-01',
    endDate : '2018-03-31
})
```


### populateStripeResource
Use to populate one stripe resource on to another

Params 
- collection : the collection to loop through and resolve from
- targetResource : the target resource you want to pull onto this collection
- foreignKey : the field used to look on stripe to find the target resource
- as = targetResource : what field should the results be saved on to (defaults to targetResource name)

eg populate all charges onto applicationFees using orginating_transaction
```
//assume you have an array of applicationFees already
const feesAndCharges = await stripetools.populateStripeResource({
    collection : applicationFees,
    targetResource : 'charges',
    foreignKey : 'originating_charge',
    as : 'chargeObject'
})
```


### safeRefund
refund a charge, but only if the account it is being refunded from has enough balance to cover it

Params
 - chargeId
 - amount : amount to refund (defaults to full amount)
 - refundApplicationFee : refund the applicationFee (defaults to true)
 - reverseTransfer = reverse the associatedTransfer (defaults to true)
 
 eg refund a charge
 ```
await stripetools.refund('<charge ID here>');

```

### multiList 
When getting all elements of a resource on stripe we have to take it at a maximum 100 items at a time. Use this
method to specify a larger limit and the limit at each step

Params
- resource : the resource we want to get
- customLimit : the max number of items we want to return (default is 500)
- stripeArgs = { limit : 100 }  number of elements to grab in each step, default and maximum is 100
