///<reference path="../all.d.ts"/>
var expect:Chai.ExpectStatic

describe('IntegratingObservable', ()=> {
    let onNext = Rx.ReactiveTest.onNext;
    let onCompleted = Rx.ReactiveTest.onCompleted;


    it('should integrate a field of a vector', ()=> {
        let scheduler = new Rx.TestScheduler();
        var input = scheduler.createHotObservable<Vector>(
            onNext(0, {x: 0, y: 0, z: 0}),
            onNext(100, {x: 0, y: 0, z: 0}),
            onNext(200, {x: 1, y: 0, z: 0}),
            onNext(300, {x: 1, y: 0, z: 0}),
            onNext(400, {x: -1, y: 0, z: 0}),
            onNext(500, {x: -1, y: 0, z: 0})
        );

        let expectedResults = [
            onNext(200, new Vector(0.05, 0, 0)),
            onNext(300, new Vector(0.15, 0, 0)),
            onNext(400, new Vector(0.15, 0, 0)),
            onNext(500, new Vector(0.05, 0, 0))
        ];

        var results = scheduler.startScheduler(
            ()=> {
                return new IntegratingObservable(input.select(Vector.fromData), scheduler);
            },
            {
                created: 0,
                subscribed: 0,
                disposed: 600
            });

        console.log(results.messages, expectedResults);

        results.messages.forEach((r, i)=> {
            let calculated = parseFloat(r.value.value.x);
            let expected = parseFloat(expectedResults[i].value.value.x);
            expect(calculated).to.be.closeTo(expected, 0.000001);
        })
    });
})


