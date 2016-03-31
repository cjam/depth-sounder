///<reference path="all.d.ts"/>

import circle = d3.geo.circle;
import Linear = d3.scale.Linear;

function sameElements(a:any, b:any) {
    if (a.length !== b.length) {
        return false;
    }
    // random trailing hex digits in the hopes of avoiding name collisions
    var objectCountProperty = 'counta2771346634949dec4c5';
    var stringCounts = {};
    var otherCounts = {};
    for (var i = 0; i < a.length; i++) {
        var item = a[i];
        if (Object(item) === item) {
            item[objectCountProperty] |= 0;
            item[objectCountProperty]++;
        } else {
            var counter = (typeof item === 'string' ? stringCounts :
                otherCounts);
            counter.hasOwnProperty(item) ? (counter[item]++) :
                (counter[item] = 1);
        }
    }
    var same = true;
    for (var i = 0; i < b.length; i++) {
        var item = a[i];
        if (Object(item) === item) {
            if (item[objectCountProperty]) {
                item[objectCountProperty]--;
            } else {
                same = false;
                break;
            }
        } else {
            var counter = (typeof item === 'string' ? stringCounts :
                otherCounts);
            if (counter.hasOwnProperty(item) && counter[item]) {
                counter[item]--;
            } else {
                same = false;
                break;
            }
        }
    }
    for (var i = 0; i < a.length; i++) {
        delete a[i][objectCountProperty];
    }
    return same;
}

interface D3ViewOptions {
    rootId : string;
    svg:SVGElement;
    svgId:string;
}


class Domains {
    static Gravity = d3.scale.linear().domain([-9, 9]);
    static Compass = d3.scale.linear().domain([-90, 0, 90]);
    // static Gamma = d3.scale.linear().domain([-90, 0, 90]);
    // static Alpha = d3.scale.linear().domain([-90, 0, 90]);
    // static Beta = d3.scale.linear().domain([-90, 0, 90]);
    // static Compass = d3.scale.linear().domain([-90, 0, 90]);
}

class Scales {
    static Gravity_To_Gain = Domains.Gravity.range([0, 4]).clamp(true);

    static Compass_To_Gain = Domains.Compass.range([4, 0, 4]).clamp(true);
    static Compass_To_X = Domains.Compass.range([-1, 0, 1]).clamp(true);
}


abstract class D3Viz<T> {
    private _rootId:string
    protected $root:JQuery
    protected svgElement:Element

    protected get _root():HTMLElement {
        return this.$root ? this.$root[0] : undefined;
    };

    protected get $svg():JQuery {
        return $(this.svgElement)
    };

    protected set $svg(selector) {
        this.svgElement = $(selector)[0];
    }

    protected get svg():d3.Selection<any> {
        return d3.select(this.svgElement)
    };

    private _currentData:T;

    constructor(options:D3ViewOptions) {
        // todo: check the options and handle svg, svgId etc.
        if (options.rootId) {
            this.$root = $("#" + options.rootId);
        }
        if (options.svgId) {
            this.$svg = $("#" + options.svgId);
            this.$root = this.$svg.parents().first();
        }

        if (this._root == undefined) {
            throw new Error("Could not find item by the Id " + this._rootId);
        }

        this.initializeSVG();

    }

    private initializeSVG() {
        if (!this.$svg) {
            this.svgElement = document.createElement("svg");
            this.$root.append(this.svgElement);
        }
        let self = this;
        $(window).resize((evt)=> {
            self.resizeVisual();
        })

        this.resizeVisual();
    }

    private resizeVisual() {
        this.preResizeVisual();
        // todo: should probably resize this using css width:100% etc
        var width = window.innerWidth, height = window.innerHeight;
        this.$svg.width(width).height(height);
        this.postResizeVisual();
    }

    protected preResizeVisual() {
        // just a hook for derrived classes
    }

    protected postResizeVisual() {
        this.refresh();
    }

    public update(data?:T) {
        if (data) {
            this._currentData = data;
        }
        this.refresh();
    }

    public refresh() {
        if (this._currentData) {
            this.updateVisualization(this.svg, this._currentData)
        }
    }

    protected abstract updateVisualization(svg:d3.Selection<any>, data:T);
}

class DepthSounderVisual extends D3Viz<IMixer> {

    private socket:ISocket;
    private dataStream:Rx.Observable<IMixer>;
    private xScale:d3.scale.Linear<number,number>;
    private yScale:d3.scale.Linear<number,number>;
    private i:number;

    constructor(options:D3ViewOptions) {
        super(options);
        this.i = 0;
        let self = this;
        this.socket = SocketManager.GetSocket();
        this.dataStream = Rx.Observable.fromEvent<IMixer>(this.socket, "mixer_changed");

        // Subscribe to the stream of mixer updates
        this.dataStream.subscribe((d)=>self.update(d));
    }

    protected postResizeVisual() {
        // update our scales based on the width
        this.xScale = d3.scale.linear().domain([0, this.$svg.width()]).range([-1.0, 1.0]).clamp(true);
        this.yScale = d3.scale.linear().domain([0, this.$svg.height()]).range([-1.0, 1.0]).clamp(true);
        super.postResizeVisual();
    }

    protected updateVisualization(svg:d3.Selection<any>, data:IMixer) {
        let self = this;
        var channelData = <IChannel[]>data.channels;
        var numChannels = channelData.length;

        console.log("data updated", data);

        function razzleDazzle() {
            let curCircle = d3.select(this);
            var x = curCircle.attr("cx");
            var y = curCircle.attr("cy");
            self.svg.insert("circle")
                .attr("class", "ghost")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 1e-6)
                .style("stroke", curCircle.style("stroke"))
                .style("opacity", 0.7)
                .attr("r", curCircle.attr("r"))
                .transition()
                .duration(2000)
                .ease(Math.sqrt)
                .attr("r", 1)
                .attr("cy", 0)
                .style("stroke-opacity", 0.2)
                .style("stroke", "#000000")
                .remove();
        }


        // Join elements with data
        var channel = svg.selectAll("circle.channel")
            .data(channelData, function (d:any) {
                return d.id;
            });

        // UPDATE
        // update old elements as needed
        svg.selectAll("circle.channel").transition()
            .duration(100)
            .attr("r", (ch)=> {
                return ch.gain * 20 + 20;
            })
            .attr("cx", (ch)=> {
                return this.xScale.invert(ch.x);
            })
            .attr("cy", (ch)=> {
                return self.$svg.height()
                //return this.yScale.invert(ch.y);
            }).each(razzleDazzle);


        // ENTER
        channel.enter()
            .append("circle")
            .attr("class", "channel")
            .attr("id", (d)=> {
                return d.id;
            })
            .style("stroke", (d)=> {
                return d.color;
            })
            .attr("cy", -100)
            .attr("cx", this.$svg.width() / 2)
            .attr("opacity", 0.0)
            .transition()
            .duration(2000)
            .attr("opacity", 0.7)
            .attr("cy", this.$svg.height() / 2)


        //var channels = svg.select("circle.channel");
        //
        //channels.transition()
        //    .duration(1000)
        //    .style("fill", function (d) {
        //        return d.enabled ? "#AA2222" : "#888888";
        //    })
        //


        channel.exit()
            .transition()
            .duration(1000)
            .ease(Math.sqrt)
            .style("stroke-opacity", 0)
            .remove()

        // todo: exit and drag


        //
        //channel.call(drag);
    }
}

class DeviceMotionVisual extends D3Viz<IChannel> {
    private socket:ISocket;
    public viewModel:ChannelViewModel;
    public motion:RxMotion;

    public acceleration:KnockoutObservable<Vector>;
    public velocity:KnockoutObservable<Vector>;
    public position:KnockoutObservable<Vector>;

    public initialCompassHeading:number;

    constructor(options:D3ViewOptions) {
        super(options);
        let self = this;
        this.motion = new RxMotion(10);
        this.socket = SocketManager.GetSocket("/device");
        this.initialCompassHeading = 0;

        this.socket.on("channel_updated", (data)=> {
            if (self.viewModel) {
                self.viewModel.apply(data);
                console.log("Updated view model", self.viewModel);
            }
        });

        this.socket.on("channel_added", (data)=> {
            if (!self.viewModel) {
                self.viewModel = new ChannelViewModel(data, {
                    autoEmit: true,
                    autoUpdate: false,
                    ioNamespace: "/device"
                });
                console.log("Created view model", self.viewModel)

                self.viewModel.dataStream.subscribe((d)=> {
                    self.update(d);
                });

                self.svg.style("opacity", 0)
                    .transition()
                    .duration(2000)
                    .ease(Math.sqrt)
                    .style("background", data.color)
                    .style("opacity", 1);

                self.hookupMotion();
                self.update(data);
            }
        });
    }

    public initialize() {
        // store the first compass heading so we can normalize
        this.motion.compassHeading.first().subscribe((d)=> {
            this.initialCompassHeading = d;
        })

    }

    private hookupMotion() {
        let self = this;
        this.initialize();
        this.motion.accelerationIncludingGravity
            .select(a=> a.z)
            .select(Scales.Gravity_To_Gain)
            .subscribe(this.viewModel.gain)

        this.motion.compassHeading.select((d)=> {
            let normalized = d - self.initialCompassHeading;
            if (normalized < 0) {
                normalized += 360;
            }
            // just some normalization to put it into a
            // continuous domain (i.e. 90 -> 90)
            normalized -= normalized > 180 ? 360 : 0;
            return normalized
        }).select((c)=>Scales.Compass_To_X(c))
            .subscribe(this.viewModel.x);

        // Wire up rotations
        this.motion.gamma.select(Math.round).subscribe(this.viewModel.gamma);
        this.motion.alpha.select(Math.round).subscribe(this.viewModel.alpha);
        this.motion.beta.select(Math.round).subscribe(this.viewModel.beta);

        //.do((d)=>console.log(d))
    }

    protected updateVisualization(svg:d3.Selection<any>, data:IChannel) {
        if (!this.motion.isSupported()) {
            svg.append("text")
                .attr("x", this.$svg.width() / 2)
                .attr("y", this.$svg.height() / 2)
                .attr("font-size", "20px")
                .attr("fill", "white")
                .text("Your browser doesn't support motion :(")
        } else {


        }

    }

}


//abstract class D3Visual<TViewModel extends IObservableViewModel,TData> extends D3Viz<TData> {
//    protected vmSubscription:{dispose:()=>void};
//
//    constructor(options:D3ViewOptions, private _viewModel:TViewModel) {
//        super(options);
//
//        if (this._viewModel == undefined) {
//            throw new Error("View model must be bound when constructing a D3 View");
//        }
//
//        // Subscribe to changes in our view model
//        this.vmSubscription = this.subscribeToViewModel(this._viewModel);
//
//        // we should now be subscribed, lets refresh
//        this.refresh();
//    }
//
//    protected abstract retrieveData(viewModel:TViewModel):TData;
//
//    protected subscribeToViewModel(viewModel:TViewModel):{dispose:()=>void} {
//        return viewModel.subscribe((val)=> {
//            this.update(this._viewModel)
//        }, this);
//    }
//
//
//    public refresh() {
//        // go and retrieve the data so that we can update the visualization
//        this.updateVisualization(this.retrieveData(this._viewModel));
//    }
//
//    protected abstract updateVisualization(data:TData);
//}
//
//class ChannelsVisual extends D3Visual<KnockoutObservableArray<ChannelViewModel>, ChannelViewModel[]> {
//    private chHammers:any;
//    private xScale:d3.scale.Linear<number,number>;
//    private yScale:d3.scale.Linear<number,number>;
//
//    constructor(options:D3ViewOptions, viewModel:KnockoutObservableArray<ChannelViewModel>) {
//        super(options, viewModel);
//
//    }
//
//    protected resizeVisual() {
//        super.resizeVisual();
//        this.xScale = d3.scale.linear().domain([0, this.$svg.width()]).range([-1.0, 1.0]).clamp(true);
//        this.yScale = d3.scale.linear().domain([0, this.$svg.height()]).range([-1.0, 1.0]).clamp(true);
//    }
//
//    private addHammerEvents(instance:HTMLElement, channel) {
//        var self = this;
//        var chHammerOptions = {
//            recognizers: [
//                [Hammer.Pinch, {enable: true}],
//                [Hammer.Tap, {event: "doubletap", enable: true, taps: 2}],
//                [Hammer.Pan, {event: "pan", enable: true}]
//            ]
//        };
//
//        if (!this.chHammers) {
//            this.chHammers = {};
//        }
//
//        if (!this.chHammers[instance.id]) {
//            // todo: should really store these so we can destroy them on exit
//            var ham = new Hammer(instance, chHammerOptions);
//            ham.on("doubletap", function (evt) {
//                var enabled = !channel.enabled();
//                channel.enabled(enabled);
//            })
//            ham.on("pinch", function (evt) {
//                channel.gain(evt.scale);
//            });
//
//            //var original = {x:0,y:0}
//            //ham.on("panstart",function(evt){
//            //    original.x = channel.x();
//            //    original.y = channel.y();
//            //});
//            //ham.on("panmove", function (evt) {
//            //    channel.x(original.x + self.xScale(evt.deltaX));
//            //    channel.y(original.y + self.yScale(evt.deltaY));
//            //})
//
//            this.chHammers[instance.id] = ham;
//        }
//
//    }
//
//    // keep a CompositeDisposable for all of the channel subscriptions
//    private _channelSubs:CompositeDisposable;
//    private _currentChannels:ChannelViewModel[] = []
//
//    private subscribeToChannels(channels:ChannelViewModel[]) {
//        this._currentChannels = this._currentChannels || [];
//
//        if (sameElements(this._currentChannels, channels)) {
//            console.debug("Same channels, skipping", this._currentChannels, channels);
//            return;
//        }
//        console.debug("Resubscribing to channels");
//
//        this._currentChannels = [];
//        // Dispose any existing subscriptions
//        this._channelSubs.disposables.forEach((dis)=> {
//            this._channelSubs.remove(dis);
//            dis.dispose();
//        }, this);
//
//
//        // And create new ones...
//        channels.forEach(function (channel) {
//            this._currentChannels.push(channel);
//            this._channelSubs.add(channel.subscribe(function () {
//                this.refresh()
//            }, this));
//        }, this);
//    }
//
//    protected subscribeToViewModel(channels:KnockoutObservableArray<ChannelViewModel>) {
//        // if we don't have the disposable for our channels, set that up
//        if (!this._channelSubs) {
//            this._channelSubs = new Rx.CompositeDisposable();
//        }
//        // Subscribe to each channel
//        this.subscribeToChannels(ko.unwrap(channels));
//
//        // Listen for changes to observable array so that we can resubscribe
//        var collectionSub = channels.subscribe(function (newChannels) {
//            this.subscribeToChannels(ko.unwrap(newChannels));
//            this.refresh()
//        }, this);
//
//        // We return a composite disposable made up of all of our disposables
//        return new Rx.CompositeDisposable(collectionSub, this._channelSubs);
//    }
//
//    protected retrieveData(viewModel:KnockoutObservableArray<ChannelViewModel>):ChannelViewModel[] {
//        return this._currentChannels;
//    }
//
//    protected updateVisualization(data:ChannelViewModel[]) {
//        // If our scales aren't setup we aren't ready to render
//        if (!this.xScale || !this.yScale) {
//            return;
//        }
//
//        let self = this;
//        var numChannels = data.length;
//
//        //var drag = d3.behavior.drag()
//        //    .on("drag", (ch:ChannelViewModel, i)=> {
//        //        console.log("channel:", i);
//        //        ch.x(this.xScale(d3.event.x));
//        //        ch.y(this.yScale(d3.event.y));
//        //    }).origin((d:ChannelViewModel)=> {
//        //        return {x: this.xScale.invert(d.x()), y: this.yScale.invert(d.y())};
//        //    });
//
//
//        // Join elements with data
//        var channel = this.svg.selectAll("circle.channel")
//            .data(data, function (d:any) {
//                return d.id();
//            });
//
//
//        channel.enter()
//            .append("circle")
//            .classed("channel", true)
//            .attr("id", function (d) {
//                return d.id();
//            })
//            .attr("cy", -100)
//            .attr("opacity", 0.0)
//            .transition()
//            .duration(1500)
//            .attr("opacity", 0.7)
//            .each(function (d, i) {
//                self.addHammerEvents(this, d);
//            })
//
//
//        channel.transition().duration(1000).style("fill", function (d) {
//            return d.enabled() ? "#AA2222" : "#888888";
//        })
//
//        channel.attr("r", (ch)=> {
//                return ch.gain() * 10 + 50;
//            })
//            .attr("cx", (ch)=> {
//                return this.xScale.invert(ch.x());
//            })
//            .attr("cy", (ch)=> {
//                return this.yScale.invert(ch.y());
//            })
//        //.call(drag);
//        //.transition()
//        //.duration(1000)
//        //.style("fill","#BBBBBB")
//
//
//        // todo: exit and drag
//
//
//        //
//        //channel.call(drag);
//
//
//    }
//}
//
//class MixerVisual {
//    private _channelsView:ChannelsVisual;
//
//    constructor(options:D3ViewOptions, private _viewModel:MixerViewModel) {
//        if (this._viewModel == undefined) {
//            throw new Error("View model can't be null");
//        }
//
//        this._channelsView = new ChannelsVisual(options, <KnockoutObservableArray<ChannelViewModel>>this._viewModel.channels);
//    }
//}


//var mixerViewModel = new MixerViewModel(mixerData);
//        ko.applyBindings(mixerViewModel, visualNode);

//        var deviceMotionAdapter = new DeviceMotionAdapter();
//        ko.applyBindings(deviceMotionAdapter, $("#DeviceInfoView")[0]);

//        var rxMotion = new RxMotion(200);
//        rxMotion.motion.subscribe(function(n){
//            console.log(n);
//        });
//
//        rxMotion.orientation.subscribe(function(n){
//            console.log(n);
//        });


// todo: figure this out to allow for desktop code to be the same
//    var touchEmulator = new TouchEmulator();

//var fullScreenViewModel = new FullScreenViewModel(visualNode)
//ko.applyBindings(fullScreenViewModel, $("#FullScreenButton")[0])
//
//
//var svg = d3.select(visualNode);
//
//var hammerOptions = {};
//var hammer = new Hammer(visual, hammerOptions);
//
//var drag = d3.behavior.drag()
//    .origin(Object)
//    .on("drag", function (d) {
//        // Update the view model
////            	    d.x(parseInt(d.x()) + d3.event.dx);
////				    d.y(parseInt(d.y()) + d3.event.dy);
//    });
//
//function ChannelsD3View(observableChannels) {
//    var self = this;
//    var chHammerOptions = {
//        recognizers: [
//            [Hammer.Pinch, {enable: true}],
//            [Hammer.Tap, {event: "doubletap", enable: true, taps: 2}]
//        ]
//    };
//    var addHammerEvents = function (instance, channel) {
//
//        Hammer(instance, chHammerOptions).on("doubletap", function (evt) {
//            var enabled = !channel.enabled();
//            channel.enabled(enabled);
//        }).on("pinch", function (evt) {
//            channel.gain(evt.scale);
//        })
//    }
//
//    self.apply = function (channelViewModels) {
//        var numChannels = channelViewModels.length;
//
//        // Join elements with data
//        var channels = svg.selectAll(".channel")
//            .data(channelViewModels, function (d) {
//                return d.id();
//            });
//        // Create new elements by transitioning them in
//        channels.enter()
//            .append("circle")
//            .attr("class", "channel")
//            .attr("id", function (d) {
//                return d.id();
//            })
//            .attr("opacity", 0.0)
//            .transition()
//            .duration(1000)
//            .attr("opacity", 0.5)
//            .each(function (d, i) {
//                addHammerEvents(this, d);
//            });
//
//        // Update existing ones by setting their x, y, etc
//        channels.attr("cx", function (d, i) {
//                return (window.innerWidth / (numChannels + 1)) * i;
//            })
//            .attr("cy", function (d, i) {
//                return window.innerHeight / 2;
//            })
//            .attr("r", function (d) {
//                return d.gain() * 50;
//            })
//            .attr('fill-opacity', function (d) {
//                if (d.enabled()) {
//                    return 0.8;
//                } else {
//                    return 0.2
//                }
//            })
//            .call(drag);
//
//        channels.exit().remove();
//    }
//
//    var subs = []; // for keeping track of subscriptions
//    // Listen for changes to the view model data...
//    observableChannels.subscribe(function (channels) {
//        self.apply(channels);
//        // Dispose any existing subscriptions
//        ko.utils.arrayForEach(subs, function (sub) {
//            sub.dispose();
//        });
//        // And create new ones...
//        ko.utils.arrayForEach(channels, function (channel) {
//            subs.push(channel.data.subscribe(function () {
//                self.apply(channels);
//            }));
//        });
//    });
//}
//
//
//var channelView = new ChannelsD3View(mixerViewModel.channels);




