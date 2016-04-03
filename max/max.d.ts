declare var post:(msg:any)=>void

interface MaxObject {
    understands(any):boolean
    varname : string;
    maxclass: string;
    rect: number[]
    message(messageName:string, ...args:any[]);
    dispose();
}

// Need to build up the rest of this from here:
// https://docs.cycling74.com/max5/vignettes/js/jspatcherobject.html
interface Patcher {
    name:string;
    newdefault(x:number, y:number, className:string, args:any[]) : MaxObject
    newobject(x:number, y:number, className:string, args:any[]) : MaxObject
    connect(source:MaxObject, outlet:number, dest:MaxObject, inlet:number)
    remove(instance:MaxObject);
}

interface max {
    patcher : Patcher
}

declare var setoutletassist:(outlet:number, description:string)=>void;
declare var outlet:(outlet:number, value:any)=>void;

declare var setinletassist:(inlet:number, description:string)=>void;

declare var arrayfromargs:(args:any[])=>string[];
declare var arrayfromargs:(msgname:any, args2:any)=>string[];

declare var jsarguments:any[]