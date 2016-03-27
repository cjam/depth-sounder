///<reference path="all.d.ts"/>

class FullScreenViewModel {
    private _$target:JQuery;

    private get _target():HTMLElement {
        return this._$target[0];
    }

    public isSupported:KnockoutObservable<boolean>;

    constructor(selector?:string|Element|JQuery) {
        this.isSupported = ko.observable<boolean>(
            document.fullscreenEnabled ||
            document.webkitFullscreenEnabled ||
            document.mozFullScreenEnabled ||
            document.msFullscreenEnabled);

        if (this.isSupported()) {
            if (selector) {
                this._$target = $(selector);
                console.info("FullScreenViewModel.target set using selector " + selector, this._target);
            } else {
                console.info("FullScreenViewModel, no item selector provided, defaulting to document body")
                this._$target = $("body");
            }
        }
    }

    public enterFullscreen() {
        // go full-screen
        if (this._target.requestFullscreen) {
            this._target.requestFullscreen();
        } else if (this._target.webkitRequestFullscreen) {
            this._target.webkitRequestFullscreen();
        } else if (this._target.mozRequestFullScreen) {
            this._target.mozRequestFullScreen();
        } else if (this._target.msRequestFullscreen) {
            this._target.msRequestFullscreen();
        } else {
            console.warn("Element doesn't support full screen", this._target);
        }
    }
}

ko.components.register("fullscreen-button", {
    viewModel: (params)=> {
        return new FullScreenViewModel(params.target)
    },
    template: '\
    <button data-bind="visible:isSupported, click:enterFullscreen"\
        class="btn-danger btn-lg">Full Screen\
    </button>'
});
