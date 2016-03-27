///<reference path="all.d.ts"/>

import circle = d3.geo.circle;
import Linear = d3.scale.Linear;
interface D3ViewOptions {
    rootId : string;
    svg:SVGElement;
    svgId:string;
    viewModel: IObservableViewModel;
}

abstract class D3Visual<TViewModel extends IObservableViewModel,TData> {
    private _rootId:string
    protected $root:JQuery
    protected svgElement:Element
    protected vmSubscription:{dispose:()=>void};

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

    constructor(options:D3ViewOptions, private _viewModel:TViewModel) {
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

        if (this._viewModel == undefined) {
            throw new Error("View model must be bound when constructing a D3 View");
        }

        this.initializeSVG();

        // Subscribe to changes in our view model
        this.vmSubscription = this.subscribeToViewModel(this._viewModel);

        // we should now be subscribed, lets refresh
        this.refresh();
    }

    protected abstract retrieveData(viewModel:TViewModel):TData;

    protected subscribeToViewModel(viewModel:TViewModel):{dispose:()=>void} {
        return viewModel.subscribe((val)=> {
            this.refresh()
        }, this);
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

    protected resizeVisual() {
        // todo: should probably resize this using css width:100% etc
        var width = window.innerWidth, height = window.innerHeight;
        this.$svg.width(width).height(height);
        this.refresh();
    }

    public refresh() {
        // go and retrieve the data so that we can update the visualization
        this.updateVisualization(this.retrieveData(this._viewModel));
    }

    protected abstract updateVisualization(data:TData);
}

class ChannelsVisual extends D3Visual<KnockoutObservableArray<ChannelViewModel>, ChannelViewModel[]> {
    private chHammers:any;
    private xScale:d3.scale.Linear;
    private yScale:d3.scale.Linear;

    constructor(options:D3ViewOptions, viewModel:KnockoutObservableArray<ChannelViewModel>) {
        super(options, viewModel);

    }

    protected resizeVisual() {
        super.resizeVisual();
        this.xScale = d3.scale.linear().domain([0, this.$svg.width()]).range([-1.0, 1.0]).clamp(true);
        this.yScale = d3.scale.linear().domain([0, this.$svg.height()]).range([-1.0, 1.0]).clamp(true);
    }

    private addHammerEvents(instance:HTMLElement, channel) {
        var self = this;
        var chHammerOptions = {
            recognizers: [
                [Hammer.Pinch, {enable: true}],
                [Hammer.Tap, {event: "doubletap", enable: true, taps: 2}],
                [Hammer.Pan, {event: "pan", enable: true}]
            ]
        };

        if (!this.chHammers) {
            this.chHammers = {};
        }

        if (!this.chHammers[instance.id]) {
            // todo: should really store these so we can destroy them on exit
            var ham = new Hammer(instance, chHammerOptions);
            ham.on("doubletap", function (evt) {
                var enabled = !channel.enabled();
                channel.enabled(enabled);
            })
            ham.on("pinch", function (evt) {
                channel.gain(evt.scale);
            });

            //var original = {x:0,y:0}
            //ham.on("panstart",function(evt){
            //    original.x = channel.x();
            //    original.y = channel.y();
            //});
            //ham.on("panmove", function (evt) {
            //    channel.x(original.x + self.xScale(evt.deltaX));
            //    channel.y(original.y + self.yScale(evt.deltaY));
            //})

            this.chHammers[instance.id] = ham;
        }

    }

    // keep a CompositeDisposable for all of the channel subscriptions
    private _channelSubs:CompositeDisposable;

    private subscribeToChannels(channels:ChannelViewModel[]) {
        // Dispose any existing subscriptions
        this._channelSubs.disposables.forEach((dis)=> {
            this._channelSubs.remove(dis);
            dis.dispose();
        }, this);


        // And create new ones...
        channels.forEach(function (channel) {
            this._channelSubs.add(channel.subscribe(function () {
                this.refresh()
            }, this));
        }, this);
    }

    protected subscribeToViewModel(channels:KnockoutObservableArray<ChannelViewModel>) {
        // if we don't have the disposable for our channels, set that up
        if (!this._channelSubs) {
            this._channelSubs = new Rx.CompositeDisposable();
        }
        // Subscribe to each channel
        this.subscribeToChannels(ko.unwrap(channels));

        // Listen for changes to observable array so that we can resubscribe
        var collectionSub = channels.subscribe(function (newChannels) {
            this.subscribeToChannels(ko.unwrap(newChannels));
            this.refresh()
        }, this);

        // We return a composite disposable made up of all of our disposables
        return new Rx.CompositeDisposable(collectionSub, this._channelSubs);
    }

    protected retrieveData(viewModel:KnockoutObservableArray<ChannelViewModel>):ChannelViewModel[] {
        return ko.utils.unwrapObservable(viewModel);
    }

    protected updateVisualization(data:ChannelViewModel[]) {
        // If our scales aren't setup we aren't ready to render
        if (!this.xScale || !this.yScale) {
            return;
        }

        let self = this;
        var numChannels = data.length;

        var drag = d3.behavior.drag()
            .on("drag", (ch:ChannelViewModel, i)=> {
                console.log("channel:", i);
                ch.x(this.xScale(d3.event.x));
                ch.y(this.yScale(d3.event.y));
            }).origin((d)=> {
                return {x: this.xScale.invert(d.x()), y: this.yScale.invert(d.y())};
            });


        // Join elements with data
        var channel = this.svg.selectAll("circle.channel")
            .data(data, function (d:any) {
                return d.id();
            });


        channel.enter()
            .append("circle")
            .classed("channel", true)
            .attr("id", function (d) {
                return d.id();
            })
            .attr("cy", -100)
            .attr("opacity", 0.0)
            .transition()
            .duration(1500)
            .attr("opacity", 0.7)
            .each(function (d, i) {
                self.addHammerEvents(this, d);
            })




        channel.transition().duration(1000).style("fill", function (d) {
            return d.enabled() ? "#AA2222" : "#888888";
        })

        channel.attr("r", (ch)=> {
                return ch.gain() * 50;
            })
            .attr("cx", (ch)=> {
                return this.xScale.invert(ch.x());
            })
            .attr("cy", (ch)=> {
                return this.yScale.invert(ch.y());
            })
        .call(drag);
        //.transition()
        //.duration(1000)
        //.style("fill","#BBBBBB")


        // todo: exit and drag


        //
        //channel.call(drag);


    }

}

class MixerVisual {
    private _channelsView:ChannelsVisual;

    constructor(options:D3ViewOptions, private _viewModel:MixerViewModel) {
        if (this._viewModel == undefined) {
            throw new Error("View model can't be null");
        }

        this._channelsView = new ChannelsVisual(options, <KnockoutObservableArray<ChannelViewModel>>this._viewModel.channels);
    }
}

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




