var showAssignedProgram = 1;
var value = null;
var showIterationCombo = 0;
var iterationComboValue = null;
var lumenize = window.parent.Rally.data.lookback.Lumenize;
var iterationComboField = null;
var iterationRecord = myMask = null;
var setOfStories = setOfFeatures = null;
var countFeatures = 0;
var features = {
	"project": "/project/7306522812", //Unity Product Family Requirements: 
	"workspace": "/workspace/3181574357" //USD
};
var stories = {
	"project": "/project/14355819910", //Teams
	"workspace": "/workspace/3181574357" //USD
};

Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        //Write app code here
         Ext.state.Manager.setProvider(
            new Ext.state.CookieProvider({ expires: new Date(new Date().getTime()+(10006060247)) })
        );
        
        app = this;
        var that = this;
        console.log("launch");
        // get the project id.
        this.project = this.getContext().getProject().ObjectID;
        
        // get the release (if on a page scoped to the release)
        var tbName = getReleaseTimeBox(this);
        
        var configs = [];
        
        configs.push({ model : "Release",             
                       fetch : ['Name', 'ObjectID', 'Project', 'ReleaseStartDate', 'ReleaseDate' ],
                       context:{ //adding context while querying stories 
		    				workspace: stories["workspace"], //USD
		    				project: stories["project"] //USD Prtfolio:6020936452 , Teams: 14355819910
		    			}, 
                       filters:[] 
        });
        configs.push({ model : "Iteration",             
                       fetch : ['Name', 'ObjectID', 'Project', 'StartDate', 'EndDate' ], 
                       context:{ //adding context while querying stories 
		    				workspace: stories["workspace"], //USD
		    				project: stories["project"] //USD Prtfolio:6020936452 , Teams: 14355819910
		    			},
                       filters:[] 
        });
        configs.push({ model : "PreliminaryEstimate", 
                       fetch : ['Name','ObjectID','Value'], 
                       
                       filters : [] 
        });
        configs.push({ model : "Tag",             
                       fetch : ['Name', 'ObjectID'], 
                       
                       filters:[ { property : "Name", operator : "Contains" , value : "UPLC" } ] 
        });
        
        async.map( configs, this.wsapiQuery, function(err,results) {
           
            that.releases  = results[0];
            that.iterations = results[1];
            that.peRecords = results[2];
            that.estimationTags = _.pluck(results[3],function(t){return t.get("ObjectID");});
            console.log("Estimation tags ",that.estimationTags);
           
            if (showAssignedProgram)
                that.createAssignedProgramCombo();
           		
           		that.createIterationCombo(that.iterations);
        });
        
        
    },
    	wsapiQuery : function( config , callback ) {
        Ext.create('Rally.data.WsapiDataStore', {
            autoLoad : true,
            limit : "Infinity",
            model : config.model,
            fetch : config.fetch,
            filters : config.filters,
            context: config.context,
            listeners : {
                scope : this,
                load : function(store, data) {
                    callback(null,data);
                }
            }
        });
    },
    
    	createAssignedProgramCombo : function() {
        // assigned Program (if set to true)
        
        this.assignedProgramCombo = Ext.create("Rally.ui.combobox.FieldValueComboBox", {
            model : "PortfolioItem/Feature",
            field : "AssignedProgram",
            stateful : true,
            stateId : "assignedProgramCombo",
            noData: false,
            context:{
            	workspace: features["workspace"],
            	project: features["project"]
            },
            listeners:{
            	scope: this,
            	change: function(field,eOpts){	
            		 if(value!="" && value!=null)
            		 {
            			 this.afterCollapse(fieldValue,value);
            		 }
            	}
            }
        });
        this.add(this.assignedProgramCombo);
    },
    
    	createIterationCombo: function(iterationRecords){
    		
    		//console.log("Iteration records ",iterationRecords);
    		iterationRecord = iterationRecords;
    		var iterations = _.map(iterationRecords, function(rec){return {name: rec.get("Name"), objectid: rec.get("ObjectID"), startDate: new Date(Date.parse(rec.get("StartDate")))};});
    		console.log('iterations', iterations);
    		
    		iterations = _.uniq(iterations, function(r){return r.name;});
    		iterations = _.sortBy(iterations, function(rec){return rec.StartDate;}).reverse();
    		
    		var iterationStore = Ext.create('Ext.data.Store', {
            fields: ['name','objectid'], data : iterations 
        });
        
        	var cb = Ext.create('Ext.form.ComboBox',{
        		
        		fieldLabel: 'Iterations',
        		store: iterationStore,
        		queryMode: 'local',
        		displayField: 'name',
        		valueField: 'name',
        		
        		listeners:{
        			scope: this,
        			change: function(field, eOpts){
        				console.log('field ', field, ' eOpts ',eOpts);
        				iterationComboValue = eOpts;
        				iterationComboField = field;
        			},
        			collapse: function(field, eOpts){
        				this.afterCollapse(field,eOpts);
        			}
        			
        			
        		}
        	});
    		this.add(cb);
    		
    	},
    	afterCollapse: function(field,eOpts){
    		var r = [];
    		_.each(field.getValue().split(","), function(rn){
    			
    			var matching_iterations = _.filter(iterationRecord, function(r){return rn == r.get("Name");});
    			var uniq_iterations = _.uniq(matching_iterations, function(r){return r.get("Name");});
    			
    			_.each(uniq_iterations,function(iteration){r.push(iteration);});
    			
    		});
    		if(r.length>0){
    			myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait..."});
               // myMask.show();
                this.selectedIterations = r;
                this.queryFeatures(r);
    		}
    	},
    	
    	
    	
    	queryFeatures: function(iterations){
    		var that = this;
    		
    		var filter = null;
    		
    		if (showAssignedProgram && this.assignedProgramCombo.getValue() != null && this.assignedProgramCombo.getValue() != "") {
    			console.log("assingedValue",this.assignedProgramCombo.getValue());
            filter = Ext.create('Rally.data.QueryFilter', {
                property: 'AssignedProgram',
                operator: '=',
                value: this.assignedProgramCombo.getValue()
            });			
    	}
    		else{
    			_.each(iterations, function(iteration, i){
    				var f = Ext.create('Rally.data.QueryFilter', {
                    property: 'Iteration.Name',
                    operator: '=',
                    value: iteration.get("Name")
                });
                filter = i === 0 ? f : filter.or(f);
    		});
    	}
    		console.log("filter",filter.toString());
    		var configs = [];
    		
    		configs.push({
    			model: 'PortfolioItem/Feature',
    			fetch: ['ObjectID','FormattedID','UserStories' ],
    			filters: [filter],//filter
    			context:{
    				workspace: features["workspace"],
    				project: features["project"]
    			},
    			listeners: {
                load: function(store, features) {
                	setOfFeatures = features;
                    console.log("# features",features.length,features);
                    that.StartDate = that.startDate(iterations);
                    that.start = _.min(_.pluck(iterations,function(r) { return r.get("StartDate");}));
                    isoStart = new lumenize.Time(that.start).getISOStringInTZ("America/Chicago");
                    console.log("isoStart1",isoStart);
                    that.end   = _.max(_.pluck(iterations,function(r) { return r.get("EndDate");}));
                    that.iterations = iterations;
                    console.log('End date ',that.end);
//                    that.getStorySnapshotsForFeatures( features, iterations);
                	}
            	}	
    		});
    		
    		configs.push({
    			model: 'HierarchicalRequirement',
    			limit: 'Infinity',
    			fetch: ['Name','Iteration','ObjectID','Feature'],
    			filters: [{
    				property: 'Iteration.Name',
    				operator: '=',
    				value: iterationComboValue
    			},
    			{ //for the sake of temporarily avoiding the error, querying for only those stories having features
    				property: 'Feature',
    				operator: '!=',
    				value: null
    			}],
    			context:{ //adding context while querying stories 
    				workspace: stories["workspace"], //USD:3181574357, Workspace1: 2154600806
    				project: stories["project"] //USD Prtfolio:6020936452 , Teams: 14355819910, Ray-test: 11838764022
    			},
    			listeners: {
    				load: function(store, stories){
    					setOfStories = stories;
    					console.log('Iteration combo value is ', iterationComboValue);
    					console.log("# stories ",stories.length,stories);
    				}
    			}
    			
    		});
    		
    		async.map(configs, this.wsapiQuery, function(err,results){
    			
    			setOfFeatures = results[0];
    			console.log("# features",setOfFeatures.length,setOfFeatures);
    			that.StartDate = that.startDate(iterations);
    			that.start = _.min(_.pluck(iterations,function(r) { return r.get("StartDate");}));
    			isoStart = new lumenize.Time(that.start).getISOStringInTZ("America/Chicago");
                
                that.end   = _.max(_.pluck(iterations,function(r) { return r.get("EndDate");}));
                that.iterations = iterations;
    			
    			setOfStories = results[1];
    			var stories = _.map(setOfStories, function(story){return {name: story.get("Name"),fid: story.get("Feature").ObjectID, objectid: story.get("ObjectID")};});
    			//printing stories, count is 104.
    			console.log('# stories ',setOfStories.length,setOfStories);
    			var features = _.map(setOfFeatures, function(feature){return {name: feature.get("Name"), fid: feature.get("ObjectID")};});
    			//still no intersection between current project's features and stories from USD Prtfolio.
    			var candidateStories = [];
    			_.each(stories, function(story){_.each(features, function(feature){
    				
    				if(story.fid == feature.fid){
    					candidateStories.push(story);    				
    					}
    			});});
    			
    			console.log('candidate stories ',candidateStories.length,candidateStories);

    			if(candidateStories!=null){
    			
    			that.getStorySnapShotsForFeatures(setOfFeatures);
    			}
    			//create snapshot store based on candidateStories.
    			
    			
    		});

    },
    getStorySnapShotsForFeatures: function(features){
    	console.log("getStorySnapShotsForFeaturesInside ");
    	var snapshots = [];
        var that = this;
        
        async.map( features, this.readFeatureSnapshots, function(err,results) {
            console.log("results",results);
            _.each(results,function(result) {
               //snapshots = snapshots.concat(result);
            	snapshots=snapshots.concat(result);
            });
            console.log("total snapshots before",snapshots.length);
           
            // filter out stories that have an estimation tag        
             snapshots = _.filter(snapshots,function(snapshot) {
             	
            	 //console.log("Intersections ",_.intersection(snapshot.get("Tags"), that.estimationTags ).length);
                 return _.intersection(snapshot.get("Tags"), that.estimationTags ).length === 0;
             });
            console.log("total snapshots after",snapshots.length);
          	
            that.createChart2(snapshots,that.releases,that.start,that.end);
        });
    },
    
    startDate: function(iterations){
    	var start = _.min(_.pluck(iterations, function(r){return r.get("StartDate");}));
    	return Rally.util.DateTime.toIsoString(start, false);
    },
    createChart2 : function ( snapshots, releases,start,end) {
            
        var that = this;
        // var lumenize = window.parent.Rally.data.lookback.Lumenize;
        var snapShotData = _.map(snapshots,function(d){return d.data;});
        console.log("snapshots",snapShotData);
        // can be used to 'knockout' holidays
        var holidays = [
        ];
        var myCalc = Ext.create("storycalculator");

        // calculator config
        var config = {
            deriveFieldsOnInput: myCalc.getDerivedFieldsOnInput(),
            metrics: myCalc.getMetrics(),
            summaryMetricsConfig: [],
            deriveFieldsAfterSummary: myCalc.getDerivedFieldsAfterSummary(),
            granularity: lumenize.Time.DAY,
            tz: 'America/Chicago',
            holidays: holidays,
            workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday'
        };
        // release start and end dates
        var startOnISOString = new lumenize.Time(start).getISOStringInTZ(config.tz);
        console.log("isoStart",startOnISOString);
        var upToDateISOString = new lumenize.Time(end).getISOStringInTZ(config.tz);
        // create the calculator and add snapshots to it.
        calculator = new lumenize.TimeSeriesCalculator(config);
        calculator.addSnapshots(snapShotData, startOnISOString, upToDateISOString);
        
        // create a high charts series config object, used to get the hc series data
        var hcConfig = [{ name : "label" }, 
                        this.pointsUnitType() ? { name : "Planned Points" } : { name : "Planned Count" }, 
                        { name : "PreliminaryEstimate"},
                        this.pointsUnitType() ? { name : "Accepted Points"} : { name : "Accepted Count"},
                        this.pointsUnitType() ? { name : "ProjectionPoints"}: { name : "ProjectionCount"},
                        // { name : "Count", type:'column'},
                        // { name : "Completed",type:'column'} 
                        ];
        var hc = lumenize.arrayOfMaps_To_HighChartsSeries(calculator.getResults().seriesData, hcConfig);
        
        this._showChart(hc);
    },
    readFeatureSnapshots : function(feature,callback) {
    	
        var that = this;
        countFeatures++;
        console.log("count is ",feature);
        feature.getCollection("UserStories").load({
            fetch : ["ObjectID"],
            callback : function(records,operation,success) {
            	console.log("User stories of features ",feature.getCollection("UserStories"));
                console.log("Feature:"+feature.get("FormattedID"),records.length,records);
                async.map(records,app.readParentStorySnapshots,function(err,results) {
                    var snapshots = new Array();
                    _.each(results,function(r) {
                      snapshots=snapshots.concat(r);
                    });
                    callback(null,snapshots);    
                });
                
            }
        });
        
      
     },
      readParentStorySnapshots : function(parent,callback) {
        console.log("Inside readParentStorySnapshots ");
        Ext.create('Rally.data.lookback.SnapshotStore', {
            limit : "Infinity",
            autoLoad : true,
            listeners: {
                scope : this,
                load: function(store, data, success) {
                    callback(null,data);
                }
            },
            fetch : ['Project', 'ScheduleState', 'PlanEstimate','Children','_ItemHierarchy','Tags'],
            hydrate : ['ScheduleState'],
            filters: [
                {
                    property: '_TypeHierarchy',
                    operator: 'in',
                    value: ['HierarchicalRequirement']
                },
                {
                    property: '_ItemHierarchy',
                    operator: 'in',
                    value: [parent.get("ObjectID")]
                },
                // {
                //     property: '_ValidTo',
                //     operator: '>',
                //     value: isoStart
                // },
                {
                    property: 'Children',
                    operator: '=',
                    value: null
                },
                {
                    property: '__At',
                    operator: '=',
                    value: 'current'
                }

            ]
        });

    },
    
    	
});
