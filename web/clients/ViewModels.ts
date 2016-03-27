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
    protected _isUpdating:boolean;
    public data:KnockoutComputed<T>
    public id:KnockoutObservable<number>;
    private socket:SocketIOClient.Socket;

    constructor(data:T, private options:IViewModelOptions = {
        autoEmit: false,
        autoUpdate: false,
        mapping: {},
        checkId: true,
        ioNamespace: "/"
    }) {
        this._isUpdating = false;
        if (!this.options) {
            this.options = {};
        }
        if (!this.options.mapping) {
            this.options.mapping = {};
        }

        console.log("Opening socket...");
        this.socket = SocketManager.GetSocket(options.ioNamespace || "/");

        // Apply the data from the constructor to create observables
        this.apply(data);

        this.data = ko.computed<T>(()=> {
            return ko.mapping.toJS(this);
        }, this);

        if (options.autoUpdate) {
            // subscribe to socket updates
            this.socket.on(this.modelName() + "_" + "changed", (message:T)=> {
                // if we're concerned with id's check to make sure it matches
                if (!options.checkId || this.id() == message.id) {
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
                this.socket.emit("update_" + this.modelName().toLowerCase(), data);
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
    gain:KnockoutObservable<number>;
    enabled:KnockoutObservable<boolean>;
    name:KnockoutObservable<string>;
    x:KnockoutObservable<number>;
    y:KnockoutObservable<number>;

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
            , checkId: false
        });
    }

    modelName():string {
        return "mixer";
    }
}



