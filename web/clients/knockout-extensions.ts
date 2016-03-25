///<reference path="all.d.ts"/>
/**
 * Created by cmcquay on 2016-03-19.
 */

interface KnockoutBindingHandlers {
    slider: KnockoutBindingHandler;
    bootstrapSwitch: KnockoutBindingHandler;
}

//noinspection TypeScriptUnresolvedVariable
ko.bindingHandlers.slider = {
    init: function (element:HTMLElement, valueAccessor) {
        $(element).bind("change", (evt) => {
            valueAccessor()(parseFloat($(element).val()));
        });
        $(element).slider();
    },
    update: function (element, valueAccessor) {
        $(element).val(parseFloat(ko.unwrap(valueAccessor())));
        $(element).slider('refresh');
    }
};

//noinspection TypeScriptUnresolvedVariable
ko.bindingHandlers.bootstrapSwitch = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        //initialize bootstrapSwitch
        $(element).bootstrapSwitch();

        // setting initial value
        $(element).bootstrapSwitch('state', valueAccessor());

        //handle the field changing
        $(element).on('switchChange.bootstrapSwitch', function (event, state) {
            var observable = valueAccessor();
            observable(state);
        });

        // Adding component options
        var options = allBindingsAccessor().bootstrapSwitchOptions || {};
        for (var property in options) {
            $(element).bootstrapSwitch(property, ko.utils.unwrapObservable(options[property]));
        }

        //handle disposal (if KO removes by the template binding)
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            $(element).bootstrapSwitch("destroy");
        });

    },
    //update the control when the view model changes
    update: function (element, valueAccessor, allBindingsAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());

        // Adding component options
        var options = allBindingsAccessor().bootstrapSwitchOptions || {};
        for (var property in options) {
            $(element).bootstrapSwitch(property, ko.utils.unwrapObservable(options[property]));
        }

        $(element).bootstrapSwitch("state", value);
    }
};

class DirtyFlag {
    private _viewModel;
    private _initialState;
    private _isInitiallyDirty;
    public isDirty:KnockoutComputed<boolean>;

    constructor(viewModel, isInitiallyDirty = false) {
        this._viewModel = viewModel;
        this._initialState = ko.observable(ko.toJSON(this._initialState));
        this._isInitiallyDirty = ko.observable(isInitiallyDirty);
        this.isDirty = ko.computed({
            owner: this,
            read: ()=> {
                return this._isInitiallyDirty() || this._initialState() !== ko.toJSON(this);
            }
        })
    }

    // todo: create view model base for the type here?
    public reset(seedData:any){

    }
}