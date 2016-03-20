/**
 * Created by cmcquay on 2016-03-19.
 */

ko.bindingHandlers.slider = {
    init: function (element, valueAccessor, bindings, viewModel, bindingContext) {
        $(element).bind('change', function (evt, ui) {
            valueAccessor()(parseFloat($(element).val()));
        });
        $(element).slider();
    },
    update: function (element, valueAccessor, bindings, viewModel, bindingContext) {
        $(element).val(parseFloat(ko.unwrap(valueAccessor())));
        $(element).slider('refresh');
    }
};

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

ko.dirtyFlag = function(root, isInitiallyDirty) {
    var result = function() {},
        _initialState = ko.observable(ko.toJSON(root)),
        _isInitiallyDirty = ko.observable(isInitiallyDirty);

    result.isDirty = ko.computed(function() {
        return _isInitiallyDirty() || _initialState() !== ko.toJSON(root);
    });

    result.reset = function(data) {
        if(!data){
            data = ko.toJSON(root);
        }
        _initialState(data);
        _isInitiallyDirty(false);
    };



    return result;
};