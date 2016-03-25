///<reference path="all.d.ts"/>
import CompositeDisposable = Rx.CompositeDisposable;
import IObservable = Rx.IObservable;
import IDisposable = Rx.IDisposable;
/**
 * Created by cmcquay on 2016-03-17.
 */

// Extensions to browser object definitions
interface IFullscreenEvents {
    mozFullScreenEnabled?:boolean;
    msFullscreenEnabled?:boolean;
    mozRequestFullScreen?:()=>void;
    msRequestFullscreen?:()=>void;
}

// extend the Document interface to include
// browser flags
interface Document extends IFullscreenEvents {
}
interface HTMLElement extends IFullscreenEvents {}

interface Window {
    DeviceOrientationEvent: Event
}

var namespace = "/"
var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

// Base View Models

interface IObservableViewModel {
    subscribe(callback:(value:any)=>void, thisArg?:any):{dispose:()=>void};
}

interface IViewModelOptions<T> {
    autoEmit?:boolean;
    autoUpdate?:boolean;
    mapping?: any;
}

abstract class ViewModelBase<T extends IUnique> implements IObservableViewModel,IUnique {
    protected _isUpdating:boolean;
    public data:KnockoutComputed<T>
    public id:KnockoutObservable<number>;

    constructor(data:T, private options:IViewModelOptions<T> = {autoEmit:false,autoUpdate:false,mapping:{}}) {
        this._isUpdating = false;
        if(!this.options){
            this.options = {};
        }
        if (!this.options.mapping) {
            this.options.mapping = {};
        }

        // Apply the data from the constructor to create observables
        this.apply(data);

        this.data = ko.computed<T>(()=> {
            return ko.mapping.toJS(this);
        }, this);

        if (options.autoUpdate) {
            // subscribe to socket updates
            socket.on(this.modelName() + "_" + "changed", (message:T)=> {
                // if this update is about us
                if (this.id() == message.id) {
                    console.log("Update received from server, updating model", message);
                    this._isUpdating = true;
                    this.apply(message);
                    this._isUpdating = false;
                }
            });
        }

        if (options.autoEmit) {
            this.data.subscribe(this.emit, this);
        }
    }

    abstract modelName():string;

    public apply(data:T) {
        try {
            ko.mapping.fromJS(data, this.options.mapping, this);
        } catch (Error) {
            console.error(Error);
        }
    }

    protected emit() {
        if (!this._isUpdating) {
            try {
                var data = this.data();
                socket.emit("update_" + this.modelName().toLowerCase(), data);
            } catch (Error) {
                console.log(Error);
            }
        }
    }

    public subscribe(callback:(value:any)=>void, thisArg?:any):{dispose:()=>void} {
        return this.data.subscribe(callback, thisArg);
    }
}

// Contracts

interface IUnique {
    id : number|KnockoutObservable<number>;
}

interface IChannel extends IUnique {
    gain:number|KnockoutObservable<number>;
    enabled:boolean|KnockoutObservable<boolean>;
    name: string|KnockoutObservable<string>;
    x:number|KnockoutObservable<number>;
    y:number|KnockoutObservable<number>;
}

interface IMixer extends IUnique {
    isPlaying:boolean|KnockoutObservable<boolean>;
    channels:IChannel[]|KnockoutObservableArray<IChannel>;
}

class ChannelViewModel extends ViewModelBase<IChannel> implements IChannel {
    gain:number|KnockoutObservable<number>;
    enabled:boolean|KnockoutObservable<boolean>;
    name:string|KnockoutObservable<string>;
    x:number|KnockoutObservable<number>;
    y:number|KnockoutObservable<number>;

    modelName():string {
        return "channel";
    }
}

class MixerViewModel extends ViewModelBase<IMixer> implements IMixer {
    isPlaying:KnockoutObservable<boolean>;
    channels:KnockoutObservableArray<ChannelViewModel>;

    constructor(data:IMixer) {
        // call super with mapping
        super(data, {
            autoEmit: true,
            autoUpdate: true,
            mapping: {
                'channels': {
                    key: function (data) {
                        console.log("Channel", data)
                        return ko.utils.unwrapObservable(data.id)
                    }
                    , create: function (options) {
                        return new ChannelViewModel(options.data);
                    }
                }
            }
        });
    }

    modelName():string {
        return "mixer";
    }
}


// Motion

interface IVector {
    x:number;
    y:number;
    z:number;
}

interface IRotation {
    gamma:number;
    alpha:number;
    beta:number;
}

interface IDeviceMotion {
    acceleration: IVector;
    accelerationIncludingGravity : IVector;
    rotationRate : number;
    interval: number;
    timestamp: number;
}

interface IDeviceOrientation {
    rotationRate : IRotation;
    compassHeading: number;
    interval: number;
    timestamp: number;
}

interface ITimestamp {
    timestamp:number;
}

// todo: translate the classes below to typescript

class RxMotion {
    public isSupported:KnockoutObservable<boolean>
    public samplingInterval:KnockoutObservable<number>

    private _disposable:CompositeDisposable;
    private _motionSubject:Rx.Subject<IDeviceMotion>;
    private _orientationSubject:Rx.Subject<IDeviceOrientation>;

    // Device Motion
    public motion:Rx.Observable<IDeviceMotion|ITimestamp>
    public acceleration:IObservable<IVector|ITimestamp>
    public accelerationIncludingGravity:IObservable<IVector|ITimestamp>
    public rotationRate:IObservable<number|ITimestamp>

    // Device Orientation
    public orientation:Rx.Observable<IDeviceOrientation|ITimestamp>;
    public gamma:IObservable<number|ITimestamp>;
    public beta:IObservable<number|ITimestamp>;
    public alpha:IObservable<number|ITimestamp>;
    public compassHeading:IObservable<number|ITimestamp>;

    constructor(samplingInterval:number) {
        this.samplingInterval = ko.observable<number>();
        this.isSupported = ko.observable<boolean>(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.DeviceOrientationEvent != undefined);
        this._disposable = new Rx.CompositeDisposable();

        this._motionSubject = new Rx.Subject<IDeviceMotion>();
        this._orientationSubject = new Rx.Subject<IDeviceOrientation>();

        // Device Motion
        this.motion = this._motionSubject.asObservable();
        this.acceleration = this.motion.pluck("acceleration").timestamp()
        this.accelerationIncludingGravity = this.motion.pluck("accelerationIncludingGravity").timestamp();
        this.rotationRate = this.motion.pluck("rotationRate").timestamp();

        // Device Orientation
        this.orientation = this._orientationSubject.asObservable();
        this.gamma = this.orientation.pluck("gamma").timestamp();
        this.beta = this.orientation.pluck("beta").timestamp();
        this.alpha = this.orientation.pluck("alpha").timestamp();
        this.compassHeading = this.orientation.pluck("webkitCompassHeading").timestamp();

        // Just wrapping the device motion events in an observable
        var motionObservable = Rx.Observable.fromEventPattern((h:(ev)=>void)=>window.addEventListener("devicemotion", h), (h:(ev)=>void)=>window.removeEventListener("devicemotion", h))
        var orientationObservable = Rx.Observable.fromEventPattern((h:(ev)=>void)=>window.addEventListener("deviceorientation", h), (h:(ev)=>void)=>window.removeEventListener("deviceorientation", h))

        if (!this.isSupported) {
            console.warn("Motion API not supported on this device");
        } else {
            // when the sampling interval changes we want to resubscribe to the observables
            // luckily this only has
            this.samplingInterval.subscribe((newInterval)=> {
                console.log("RxMotion.samplingInterval set", newInterval)
                // dispose of previous subscriptions
                if (this._disposable.length > 0) {
                    this._disposable.dispose();
                }
                this._disposable = new Rx.CompositeDisposable();
                if (newInterval > 0) {
                    this._disposable.add(motionObservable.sample(newInterval).subscribe(this._motionSubject));
                    this._disposable.add(orientationObservable.sample(newInterval).subscribe(this._orientationSubject));
                } else {
                    console.info("RxMotion sampling turned off")
                }
            }, this)
        }
        this.samplingInterval(samplingInterval ? 100 : samplingInterval);
    }
}


//
//function ObservableMotion() {
//    var self = this;
//
//    var motionSchema = {
//        acceleration: {x: 0.0, y: 0.0, z: 0.0},
//        accelerationIncludingGravity: {x: 0.0, y: 0.0, z: 0.0},
//        rotationRate: {gamma: 0.0, alpha: 0.0, beta: 0.0},
//        interval: 0.0,
//        timestamp: 0
//    }
//
//    self.apply = function (event) {
//        var motionObj = {
//            acceleration: event.acceleration,
//            accelerationIncludingGravity: event.accelerationIncludingGravity,
//            rotationRate: event.rotationRate,
//            interval: event.interval,
//            timestamp: event.timestamp
//        }
//
//        ko.mapping.fromJS(motionObj, {}, self);
//    }
//
//    self.apply(motionSchema);
//
//    // Computed properties
//
//    var throttleMs = 100;
//
//    var _lastAccel = {x: 0.0, y: 0.0, z: 0.0};
//    var _velocity = {x: 0.0, y: 0.0, z: 0.0};
//    this.velocity = {
//        x: ko.computed(function () {
//            // ( Ax(t) - Ax(t-1) ) / 2 * interval = delta_acceleration
//            var current = self.acceleration.x();
//            var last = _lastAccel.x;
//            _lastAccel.x = current;
//            _velocity.x = _velocity.x + (current - last) / 2.0 * self.interval();
//            return _velocity.x;
//        }).extend({rateLimit: throttleMs}),
//        y: ko.computed(function () {
//            var current = self.acceleration.y();
//            var last = _lastAccel.y;
//            _lastAccel.y = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs}),
//        z: ko.computed(function () {
//            var current = self.acceleration.z();
//            var last = _lastAccel.z;
//            _lastAccel.z = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs})
//    }
//
//
//    var _lastVelocity = {x: 0.0, y: 0.0, z: 0.0};
//    var _position = {x: 0.0, y: 0.0, z: 0.0};
//    this.position = {
//        x: ko.computed(function () {
//            // ( Ax(t) - Ax(t-1) ) / 2 * interval = delta_acceleration
//            var current = self.velocity.x();
//            var last = _lastVelocity.x;
//            _lastVelocity.x = current;
//            _position.x = _position.x + (current - last) / 2.0 * self.interval();
//            return _position.x;
//        }).extend({rateLimit: throttleMs}),
//        y: ko.computed(function () {
//            var current = self.velocity.y();
//            var last = _lastVelocity.y;
//            _lastVelocity.y = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs}),
//        z: ko.computed(function () {
//            var current = self.velocity.z();
//            var last = _lastVelocity.z;
//            _lastVelocity.z = current;
//            return (current - last) / 2.0 * self.interval();
//        }).extend({rateLimit: throttleMs})
//    }
//}
//
//function DeviceMotionAdapter(updateInterval) {
//    var self = this;
//
//    this.isSupported = new ko.observable(false);
//    this.isTracking = new ko.observable(false);
//    this.motion = new ObservableMotion();
//
//
//    // Check if mobile
//    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && window.DeviceOrientationEvent) {
//        this.isSupported(true);
//    }
//
//    var deviceInfo = {
//        motion: {},
//        orientation: {}
//    }
//
//    var pushDeviceInfo = function () {
//        if (self.isTracking()) {
//            deviceSocket.emit("changed", deviceInfo);
//        }
//    }
//
//    var handleMotionEvent = function (event) {
//        deviceInfo.motion = event;
//        self.motion.apply(event);
//    }
//
//    var handleOrientationEvent = function (event) {
//        deviceInfo.orientation = event;
//    }
//
//    if (this.isSupported()) {
//        var deviceSocket = io("/device")
//        deviceSocket.on('connect', function (evt) {
//            deviceInfo.id = deviceSocket.id;
//        });
//    }
//
//    var subscription = -1;
//    this.isTracking.subscribe(function (val) {
//        // todo: check if we're already subscribed?
//        if (val) {
//            console.log("Subscribing to device motion");
//            window.addEventListener("devicemotion", handleMotionEvent, true);
//            window.addEventListener("deviceorientation", handleOrientationEvent, true);
//
//            if (!updateInterval) {
//                updateInterval = 10000;
//            }
//            subscription = setInterval(pushDeviceInfo, updateInterval)
//        } else {
//            window.removeEventListener("devicemotion", handleMotionEvent, true);
//            window.removeEventListener("deviceorientation", handleOrientationEvent, true)
//            clearInterval(subscription);
//        }
//    })
//}


