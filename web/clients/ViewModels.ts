///<reference path="all.d.ts"/>
import CompositeDisposable = Rx.CompositeDisposable;
import IObservable = Rx.IObservable;
import IDisposable = Rx.IDisposable;
import Disposable = Rx.Disposable;
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
interface HTMLElement extends IFullscreenEvents {
}

interface Window {
    DeviceOrientationEvent: Event
}

//var namespace = "/"
//var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

// Base View Models

interface IObservableViewModel {
    subscribe(callback:(value:any)=>void, thisArg?:any):{dispose:()=>void};
}

interface IViewModelOptions {
    autoEmit?:boolean;
    autoUpdate?:boolean;
    mapping?: any;
    checkId?: boolean;
    ioNamespace?:string;
}

abstract class ViewModelBase<T extends IUnique> implements IObservableViewModel,IUnique {
    public data:KnockoutComputed<T>
    public dataStream:Rx.Observable<T>;
    public id:KnockoutObservable<number>;
    private socket:ISocket;
    public autoEmit:KnockoutObservable<boolean>;
    public autoUpdate:KnockoutObservable<boolean>;

    constructor(data:T, private options:IViewModelOptions = {
        autoEmit: false,
        autoUpdate: false,
        mapping: {},
        checkId: true,
        ioNamespace: "/"
    }) {
        let self = this;

        if (!this.options) {
            this.options = {};
        }

        if (!this.options.mapping) {
            this.options.mapping = {};
        }

        this.socket = SocketManager.GetSocket(options.ioNamespace || "/");
        console.log("Opening socket...", this.socket);
        ;

        // Apply the data from the constructor to create observables
        this.apply(data);

        this.data = ko.computed<T>(()=> {
            return ko.mapping.toJS(this);
        }, this);

        this.dataStream = this.data.toObservableWithReplyLatest()

        // Auto Emit
        this.autoEmit = ko.observable<boolean>(options.autoEmit || false);
        var emitStream = this.dataStream.where((d)=>self.autoEmit()).pausable();
        emitStream.throttle(10).subscribe((d)=> {
            self.emit();
        });

        this.autoUpdate = ko.observable<boolean>(options.autoUpdate || false);

        var updateStream = Rx.Observable.fromEvent<T>(this.socket, this.modelName() + "_" + "changed")
        updateStream.throttle(20).where((d)=>self.autoUpdate()).subscribe((data)=> {
            if (!options.checkId || this.id() == data.id) {
                console.debug("_Update received from server", data);
                emitStream.pause();
                self.apply(data);
                emitStream.resume();
            }
        });

        emitStream.resume();
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
        try {
            var data = this.data();
            //console.debug("Pushing model to server", data);
            this.socket.emit("update_" + this.modelName().toLowerCase(), data);
        } catch (Error) {
            console.error(Error);
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
    gamma:number|KnockoutObservable<number>;
    beta:number|KnockoutObservable<number>;
    alpha:number|KnockoutObservable<number>;
    color:string|KnockoutObservable<string>;
}

interface IMixer extends IUnique {
    isPlaying:boolean|KnockoutObservable<boolean>;
    channels:IChannel[]|KnockoutObservableArray<IChannel>;
}

class ChannelViewModel extends ViewModelBase<IChannel> implements IChannel {
    gain:KnockoutObservable<number>;
    enabled:KnockoutObservable<boolean>;
    name:KnockoutObservable<string>;
    x:KnockoutObservable<number>;
    y:KnockoutObservable<number>;
    gamma:KnockoutObservable<number>;
    beta:KnockoutObservable<number>;
    alpha:KnockoutObservable<number>;
    color:KnockoutObservable<string>;

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
                        return ko.utils.unwrapObservable(data.id)
                    }
                    , create: function (options) {
                        return new ChannelViewModel(options.data);
                    }
                }
            }
            , checkId: false
        });
    }

    modelName():string {
        return "mixer";
    }
}



