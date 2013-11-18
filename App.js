var showAssignedProgram = 1;
var value = null;
var showIterationCombo = 0;
var iterationComboValue = null;
var lumenize = window.parent.Rally.data.lookback.Lumenize;
var iterationComboField = null;
var iterationRecord = myMask = null;
var setOfStories = setOfFeatures = null;

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
                       filters:[] 
        });
        configs.push({ model : "Iteration",             
                       fetch : ['Name', 'ObjectID', 'Project', 'StartDate', 'EndDate' ], 
                       filters:[] 
        });
        
        async.map( configs, this.wsapiQuery, function(err,results) {
           
            that.releases  = results[0];
            that.iterations = results[1];
           
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
                myMask.show();
                
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
    			filters: [filter],
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
    			}],
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
    			_.each(results[0], function(f){console.log('f',f.get("ObjectID"));});
    			//console.log('sets ',setOfFeatures.length);
    			console.log("# features",setOfFeatures.length,setOfFeatures);
    			that.StartDate = that.startDate(iterations);
    			that.start = _.min(_.pluck(iterations,function(r) { return r.get("StartDate");}));
    			isoStart = new lumenize.Time(that.start).getISOStringInTZ("America/Chicago");
                
                console.log("isoStart1",isoStart);
                that.end   = _.max(_.pluck(iterations,function(r) { return r.get("EndDate");}));
                that.iterations = iterations;
                console.log('End date ',that.end); 
    			
    			setOfStories = results[1];
    			var candidateStories = _.each(results[1], function(story){return _.each(results[0],function(f){return f.get("ObjectID") === story.get("Feature").ObjectID;});});
    			console.log('# candidates ', candidateStories.length, candidateStories);
    			
    			
    			//create snapshot store based on candidateStories.
    			
    			
    		});
    		
    		
    		/*
    		 * up next
    		 * 5 - Filter the set of returned stories to the set of features (using the Feature attribute on stories).
    		 *  
    		 * You may be able to use the underscore _.filter() and/or _.intersection() to make this easier.
    		 */
    		
    		
    		
    },
    startDate: function(iterations){
    	var start = _.min(_.pluck(iterations, function(r){return r.get("StartDate");}));
    	return Rally.util.DateTime.toIsoString(start, false);
    }
    
    	
});
