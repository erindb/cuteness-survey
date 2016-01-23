// I'm implementing the experiment using a data structure that I call a **sequence**. The insight behind sequences is that many experiments consist of a sequence of largely homogeneous trials that vary based on a parameter. For instance, in this example experiment, a lot stays the same from trial to trial - we always have to present some number, the subject always has to make a response, and we always want to record that response. Of course, the trials do differ - we're displaying a different number every time. The idea behind the sequence is to separate what stays the same from what differs - to **separate code from data**. This results in **parametric code**, which is much easier to maintain - it's simple to add, remove, or change conditions, do randomization, and do testing.

// ## High-level overview
// Things happen in this order:
// 
// 1. Compute randomization parameters (which keys to press for even/odd and trial order), fill in the template <code>{{}}</code> slots that indicate which keys to press for even/odd, and show the instructions slide.
// 2. Set up the experiment sequence object.
// 3. When the subject clicks the start button, it calls <code>experiment.next()</code>
// 4. <code>experiment.next()</code> checks if there are any trials left to do. If there aren't, it calls <code>experiment.end()</code>, which shows the finish slide, waits for 1.5 seconds, and then uses mmturkey to submit to Turk.
// 5. If there are more trials left, <code>experiment.next()</code> shows the next trial, records the current time for computing reaction time, and sets up a listener for a key press.
// 6. The key press listener, when it detects either a P or a Q, constructs a data object, which includes the presented stimulus number, RT (current time - start time), and whether or not the subject was correct. This entire object gets pushed into the <code>experiment.data</code> array. Then we show a blank screen and wait 500 milliseconds before calling <code>experiment.next()</code> again.

// ## Helper functions

var startTime = (new Date()).getTime();
function time() {
  var now = (new Date()).getTime();
  return now - startTime;
}

// Shows slides. We're using jQuery here - the **$** is the jQuery selector function, which takes as input either a DOM element or a CSS selector string.
function showSlide(id) {
  // Hide all slides
	$(".slide").hide();
	// Show just the slide we want to show
	$("#"+id).show();
}

// Get a random integer less than n.
function randomInteger(n) {
	return Math.floor(Math.random()*n);
}

// Get a random element from an array (e.g., <code>random_element([4,8,7])</code> could return 4, 8, or 7). This is useful for condition randomization.
function randomElement(array) {
  return array[randomInteger(array.length)];
}

var nAnimals = 3;
var trialOrder = function() {
  var permutation = _.shuffle(_.range(nAnimals));
  var pairs = [];
  for (var i=0; i<nAnimals; i++) {
    pairs.push({
      kittenImage: "kitten" + permutation[i] + ".jpg",
      puppyImage: "puppy" + i + ".jpg"
    });
  }
  return pairs;
}();
var possiblePositions = [
      {left: "kitten", right: "puppy"},
      {left: "puppy", right: "kitten"} ];

// Show the instructions slide -- this is what we want subjects to see first.
showSlide("instructions");

// ## The main event
// I implement the sequence as an object with properties and methods. The benefit of encapsulating everything in an object is that it's conceptually coherent (i.e. the <code>data</code> variable belongs to this particular sequence and not any other) and allows you to **compose** sequences to build more complicated experiments. For instance, if you wanted an experiment with, say, a survey, a reaction time test, and a memory test presented in a number of different orders, you could easily do so by creating three separate sequences and dynamically setting the <code>end()</code> function for each sequence so that it points to the next. **More practically, you should stick everything in an object and submit that whole object so that you don't lose data (e.g. randomization parameters, what condition the subject is in, etc). Don't worry about the fact that some of the object properties are functions -- mmturkey (the Turk submission library) will strip these out.**

var experiment = {
  // Parameters for this sequence.
  trials: trialOrder,
  // An array to store the data that we're collecting.
  data: [],
  events: [],
  // The function that gets called when the sequence is finished.
  end: function() {
    clearInterval(setIntervalId);
    // Show the finish slide.
    showSlide("finished");
    // Wait 1.5 seconds and then submit the whole experiment object to Mechanical Turk (mmturkey filters out the functions so we know we're just submitting properties [i.e. data])
    setTimeout(function() { turk.submit({
      trials: experiment.data,
      events: events,
      startTime: startTime
    }) }, 1500);
    console.log(JSON.stringify(events));
  },
  // The work horse of the sequence - what to do on every trial.
  next: function() {
    // If the number of remaining trials is 0, we're done, so call the end function.
    if (experiment.trials.length == 0) {
      experiment.end();
      return;
    }
    
    // Get the current trial - <code>shift()</code> removes the first element of the array and returns it.
    var trialImages = experiment.trials.shift();
    
    showSlide("stage");

    var positions = _.sample(possiblePositions);
    function position(dir) {
      var animal = positions[dir];
      var imageFile = trialImages[animal + "Image"];
      var div = $("<div/>", {class: "animalContainer"});
      var img = $("<img/>", {class: "animal", src: "images/" + imageFile} );
      img.appendTo(div);
      $("#stage").append(div);
      div.hide();
      div.click(function() {
        var clickTime = time();
        experiment.data.push({
          animal: animal,
          imageFile: imageFile,
          position: dir,
          trialStartTime: experiment.trialStartTime,
          clickTime: clickTime,
          rt: clickTime - experiment.trialStartTime
        })
        $(".animalContainer").remove();
        experiment.next();
      });
    }
    position("left");
    position("right");
    setTimeout(function() {
      $(".animalContainer").show();
      // Get the current time so we can compute reaction time later.
      experiment.trialStartTime = time();
    }, 500);
  }
}

///// record all the events
var x = 0;
var y = 0;
var events = [];

var slideLeftMargin = parseFloat($(".slide").css("margin-left")) +
      parseFloat($(".slide").css("padding-left"))

document.onmousemove = function(e) {
  x = (e.pageX - slideLeftMargin) / $(".slide").width();
  y = e.pageY / $(".slide").height();
};
$(document).click(function(e) {
  events.push({
        type: "click",
        x: x,
        y: y,
        time: time()
  });
});
$(document).keyup(function(e){
  events.push({
        type: "keyup",
        keyCode: e.keyCode,
        key: String.fromCharCode(e.keyCode),
        time: time()
  });
});
var setIntervalId;
$(document).ready(function() {
  $(".continue").click(function() {
    $(this).unbind("click");
    this.blur();
    events.push({
          type: "click",
          x: x,
          y: y,
          time: time()
    });
    experiment.next();
  });
  setIntervalId = setInterval(function(e) {
    events.push({
          type: "position",
          x: x,
          y: y,
          time: time()
    });
  }, 50);
});