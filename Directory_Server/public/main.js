//Chat input validation whitelist
var display;
var tagWhitelist_ = {
	'A': true,
	'B': true,
	'BODY': true,
	'BR': true,
	'DIV': true,
	'EM': true,
	'HR': true,
	'I': true,
	'IMG': true,
	'P': true,
	'SPAN': true,
	'STRONG': true
};
var attributeWhitelist_ = {
	'href': true,
	'src': true
};

//Fallback if browser does not support Date.now()
if (!Date.now) {
	Date.now = function() { return new Date().getTime(); }
}

/*
 * Function to get current timestamp, which is an integer representing the count of [epoc_length] periods which have elapsed since 1970(?)
 */
function getTimeStamp()
{
	epoch_length = 1000; //epoch length in minutes
	return Math.floor(Date.now() / (60000 * epoch_length));
}

/*
 * Function to get current timestamp and add one, thereby returning the timestamp of the next epoch
 */
function getNextTimeStamp()
{
	return getTimeStamp() + 1;
}

/*
 * Function to sanitize chat input according to the whitelists established above
 *
 * @param input: the text to be sanitized
 * @return the sanitized string
 */
function sanitizeHtml(input) {
	var iframe = document.createElement('iframe');
	if (iframe['sandbox'] === undefined) {
		//alert('Your browser does not support sandboxed iframes. Please upgrade to a modern browser.');
		return '';
	}
	iframe['sandbox'] = 'allow-same-origin';
	iframe.style.display = 'none';
	document.body.appendChild(iframe); // necessary so the iframe contains a document
	iframe.contentDocument.body.innerHTML = input;

	function makeSanitizedCopy(node) {
		if (node.nodeType == Node.TEXT_NODE) {
			var newNode = node.cloneNode(true);
		} else if (node.nodeType == Node.ELEMENT_NODE && tagWhitelist_[node.tagName]) {
			newNode = iframe.contentDocument.createElement(node.tagName);
			for (var i = 0; i < node.attributes.length; i++) {
				var attr = node.attributes[i];
				if (attributeWhitelist_[attr.name]) {
					newNode.setAttribute(attr.name, attr.value);
				}
			}
			for (i = 0; i < node.childNodes.length; i++) {
				var subCopy = makeSanitizedCopy(node.childNodes[i]);
				newNode.appendChild(subCopy, false);
			}
		} else {
			newNode = document.createDocumentFragment();
		}
		return newNode;
	};
	resultElement = makeSanitizedCopy(iframe.contentDocument.body);
	document.body.removeChild(iframe);
	return resultElement.innerHTML;
	//alert(resultElement);
	resultElement = msg;
};

$(document).ready(function() {
	/*
	 * Initially hide everything from the user
	 *
	 */
	$('#myModal').modal('hide');
	$('#SMPmodal').modal('hide');
	$('#SMPfailureModal').modal('hide');
	$("#SMPfailSecond").hide();
	$("#SMPfailThird").hide();
	$("#typing").hide();
	$("#welcome").hide();
	$("#username_taken").hide();
	$("#username_loading").hide();
	$("#new_partner_alert").hide();
	$("warn_users_smp").hide();
	$('#chat_body').slimScroll({
		color: '#dfdfdf',
		height: '100%',
		width: '100%',
		alwaysVisible: false,
		size: '0.7em',
		//wheelStep: 1,
	});
	$('#contacts').slimScroll({
		color: '#000',
		height: '90%',
		width: '101%',
		alwaysVisible: false,
		size: '1em',
		//wheelStep: 1,
	});

	disableChat();

	/*
	 * Set up global variables
	 *
	 */
	var username;
	var uname;
	var client;
	var nodes;
	var message_array = [];
	var creds = [];
	var sessionIDs = [];
	var encrypt_relay_IVs = [];
	var decrypt_relay_IVs = [];
	var clientkeyx1;
	var clientkeyx2;
	var gx1;
	var gx2;
	var chat_key;
	var chat_encrypt_iv;
	var chat_decrypt_iv;
	var presence_server_key = null;
	var presence_server_encrypt_iv;
	var presence_server_decrypt_iv;
	var connected = false;
	var acceptor = false;
	var typing = false;
	var privateUser = true;
	var newData;
	var pwd = null; //user's password
	var protectedpassword;
	var circuitLength = 3;
	var smpButtonIconClass = 'glyphicon glyphicon-lock';
	var smpButtonClass = 'btn-primary';
	var oldContent = null;
	var oldContentSelector;
	var key_base = 95;
	var queue = [];
	var i;
	var base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var lilac_initials = '<span class="chat_initials im_dialog_photo center" style="background:#000">L</span>'
	var my_initials;
	var their_initials;
	//SMP variables
	var initiated = false;
	var smpAsked = false;
	var h;
	var modp = str2bigInt("133294399882575758380143779458803658621711224322668460285458826191727627667054255404674269333491950155273493343140718228407463573528003686665212740575911870128339157499072351179666739658503429931021985160714113146720277365006623692721807916355914275519065334791400296725853788916042959771420436564784273910949", 10, 32); //fixed large random prime to be used in SMP
	var question = null;
	var passcode; //SMP shared password
	var a, alpha, r, p, q, g, gamma, pBar, qBar, t, c;

	var low_IV_start = "AAAAAAAAAAAA";
	var high_IV_start = "////////////";
	var gx_IV = "AAAAAAAAAAAA";

	var hidden = false;

	get_creds();

	//Listeners to control what happens when certain actions take place on input fields
	$('#username').keypress(function(e) {
		if(e.keyCode == 13) {
			e.preventDefault();
			$('#usernameButton').trigger('click');
		}
	});
	$('#password').keypress(function(e) {
		if(e.keyCode == 13) {
			e.preventDefault();
			$('#usernameButton').trigger('click');
		}
	});
	$('#search_username').keypress(function(e) {
		if(e.which == 13) {
			$('#search').trigger('click');
		}
	});
	$('#chat_input').keypress(function(e) {
		if(e.which == 13  && !e.shiftKey) {
			e.preventDefault();
			validateMessage();
		}
		else if(this.scrollTop) {
			adjust_chat_input_height();
		}
	});
	$('#chat_input').keyup(function(e) {
		if(this.scrollTop) {
			adjust_chat_input_height();
		}
	});
	function scrollDown(){
		//var scrollTo_val = $('#chat_body').prop('scrollHeight') + 'px';
		$("#chat_body").animate({ scrollTop: $("#chat_body").prop("scrollHeight")}, "slow");
	}
	/*
	 * Adjust the chat input height upwards (up to a certain limit) if a new line is needed.
	 * After the limit os reached, the input area becomes scrollable
	 */
	$("#hide").on('click',function(){
		hide();
	});
	$("#hide").on('touch',function(){
		hide();
	});
	function hide() {
		hidden = !(hidden);
		if (hidden) {
			$("#sidebar").hide().animate("slow");
			$("#convobar").removeClass("col-lg-9");
			$("#convobar").addClass("col-lg-12");
			$("#hide").removeClass("glyphicon-chevron-left");
			$("#hide").addClass("glyphicon-chevron-right");
		} else {
			$("#sidebar").show().animate("slow");
			$("#convobar").removeClass("col-lg-12");
			$("#convobar").addClass("col-lg-9");
			$("#hide").removeClass("glyphicon-chevron-right");
			$("#hide").addClass("glyphicon-chevron-left");
		}
	}

	$('#chat_input').keypress(function(e) {
		if(e.which == 13  && !e.shiftKey) {
			e.preventDefault();
			//$('#sendMessage').trigger('click');
		}
		if(this.scrollTop)
		{
			adjust_chat_input_height();
		}
	});
	$('#chat_input').keyup(function(e) {
		if(this.scrollTop)
		{
			adjust_chat_input_height();
		}
	});
	$(window).on('resize', function(){
		  adjust_chat_body_height();
	});
	/*
	 * Adjust the chat input height upwards (up to a certain limit) if a new line is needed.
	 * After the limit os reached, the input area becomes scrollable
	 */
	function adjust_chat_input_height() {
		var height = $('#chat_input').height();
		height = height / parseFloat($("body").css('font-size'));
		if (height < 3.2)
		{
			height += 1;
			//$('#chat_input').css('margin-top', margin_height + 'em');
			$('#chat_input').css('height', height + 'em');
			$('#chat_input_row').css('height', (height+1.5) + 'em');
			$('#chat_input_column').css('height', (height+1.5) + 'em');
			adjust_chat_body_height();
		}
	}

	function default_chat_input_height(){
		$('#chat_input').css('height', 0.5 + 'em');
		adjust_chat_input_height();
	}

	function adjust_chat_body_height(){
		$('#chat_body').css('height', ($('#chat_container').height() - $('#chat_input_row').height()));
	}

	adjust_chat_body_height();

	$( "#menu" ).draggable({ containment: "#body", scroll: false });
	$( "#menu" ).on('click',function(){
		//
	});
	$( "#menu" ).on('touch',function(){
		//
	});
	$( "#end_chat" ).on('click',function(){
		endConversation();
		//end chat
	});
	$( "#end_chat" ).on('touch',function(){
		endConversation();
		//end chat
	});

	/*
	 * Generates a curve 25519 key pair
	 *
	 * @return an object containing puclicKey and privateKey attributes
	 */
	function get_key_pair() {
		var privKey = chance.string(
		{
			length: 64,
			pool: '0123456789ABCDEF'
		});
		var pubKey = straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(privKey)), curve25519_nine())));
		var key_pair = {
			privateKey: privKey,
			publicKey: pubKey,
		};
		return key_pair;
	}

	/*
	 * Sends a request to register a user's presence on the presenct server
	 *
	 * @param user1: the hashed username of the user for the current epoch
	 * @param user2: the hashed username of the user for the next epoch
	 */
	function register_presence(user1, user2) {
		var data = {username1: user1, username2: user2};
		data = prepare_outgoing('register presence', data, circuitLength);
	}

	/*
	 * Welcomes a user to the system once they have entered their username [and password] [and their presence has been registered]
	 * Also issues a call to retrieve the user's contacts if a password is entered
	 */
	function welcome_user() {
		$("#welcome").text("Welcome, "+username+", and thank you for using Lilac!");
		$("#menu").show();
		$("#welcome").slideDown();
		setTimeout(function() {
			$("#welcome").slideUp();
			$('#myModal').modal('hide');
			$("#username_form").slideDown();
			$("#welcome").hide();
			$("#username_taken").hide();
		}, 2000);
		addMyusernameRow();
		if (pwd) {
			get_contacts();
		}
	}

	function get_initials(username) {
		return username.slice(0,1)+username.slice(1,2);
	}

	function get_color(username) {
		var hash = CryptoJS.MD5(username);
		return "#" + hash.toString().slice(0,6);
	}

	function create_initials(username) {
		var initials = get_initials(username);
		var bgcolor = get_color(username);
		return '<span class="chat_initials im_dialog_photo center" style="background:' + bgcolor  + '">' + initials + '</span>'
	}

	/*
	 * Generates the personalized, persistent greeting message
	 */
	function addMyusernameRow() {
		var initials = get_initials(username);
		var bgcolor = get_color(username);
		$('#user_initials').html('<span class="peer_initials im_dialog_photo" style="background:' + bgcolor  + '" title="' + username + '">' + initials + '</span>');
		$('#user_name').html('<h4 class="text-primary" style="text-align:center;font-style:bold" title="' + username + '">'+ username.substring(0,10) + '</h4>');
		my_initials = create_initials(username);
	}

	window.onload = function() {
		var fileInput = document.getElementById('upload_contacts');

		fileInput.addEventListener('change', function(e) {
			var file = fileInput.files[0];
			var textType = /text.*/ ;

			if (file.type.match(textType)) {
				var reader = new FileReader();

				reader.onload = function(e) {
					text = reader.result;
					try {
						decrypted = CryptoJS.AES.decrypt(text, protectedpassword);
						decrypted_contacts= CryptoJS.enc.Utf8.stringify(decrypted);
						contacts_arr = decrypted_contacts.split(',');
						for(i=0;i<= contacts_arr.length;i++){
							if(contacts_arr[i] == undefined || contacts_arr[i].length == 0) {
								return 0;
							} else {
								add_contact(contacts_arr[i]);
							}
						}
					} catch(e) {
						alert("Invalid File!");
					}
				}
				reader.readAsText(file);
			} else {
				alert("File not supported!");
			}
		});
	}

	var clearBn = $("#reset-contacts");

	// Setup the clear functionality
	clearBn.on("click", function() {
		var control = $("#upload-contacts");
		control.replaceWith( control.val('').clone( true ) );
	});

	//code end
	var delete_contact_arr = [];
	$('#delete_contacts').click( function() {
		delete_contact_arr = get_contacts();
		for(i= 0; i<=delete_contact_arr.length;i++) {
			delete_contact(delete_contact_arr[i]);
		}
	});

	$('#download_contacts').click( function() {
		var text = get_contacts().toString();
		var encrypted = CryptoJS.AES.encrypt(text, protectedpassword);
		var filename = username+"'s "+"contacts.txt";
		var pom = document.createElement('a');
		pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(encrypted));
		pom.setAttribute('download', filename);

		if (document.createEvent) {
		    var event = document.createEvent('MouseEvents');
		    event.initEvent('click', true, true);
		    pom.dispatchEvent(event);
		}
		else {
		    pom.click();
		}
	});

	/*
	 * Generates a dynamic entry for a newly added contact
	 * The HTML for the contact should solely reside here
	 *
	 * @param contact_name: the name of the newly added contact
	 * @return the HTML contact row element
	 */
	function makeContactRow(contact_name) {
		var initials = contact_name.slice(0,1)+contact_name.slice(1,2);
		var hash = CryptoJS.MD5(contact_name);
		var bgcolor = "#" + hash.toString().slice(0,6);
		contact_name = contact_name.trim();
		return $('<div id="' + contact_name + '" class="contactRow row" style="display:none;"><div class="row"><div class="center" style="background:transparent;margin-bottom: 10px;margin-left: 13%;margin-right: 12%;"><div  class="col-lg-2"><span class="peer_initials im_dialog_photo" style="background:' + bgcolor + '" title="' + contact_name + '">' + initials + '</span></div><div id="users" style="text-align:justify" class="col-lg-6"><h5 class="" style="text-align:justify;color:black" title="' + contact_name + '">&nbsp&nbsp&nbsp' + contact_name.substring(0,10) + '</h5></div><div  class="col-lg-2"><a id="' + contact_name + '" style="text-decoration:none;color:#707070"class=" center glyphicon glyphicon-comment message-contact" title=Message "' + contact_name + '"></a></div><div  class="col-lg-2"><a id="' + contact_name + '" style="text-decoration:none;color:red" class="center glyphicon glyphicon-trash delete-contact"  title=Delete "' + contact_name + '"></a></div></div></div><div align="" style="margin: 0px; padding: 0px; background-color:#dfdfdf; height: 1px;" width="100%"></div>');
	}

	/*
	 * Dynamically inserts a new contact entry in the contact list, maintaining the alphabetic order
	 *
	 * @param contact_name: the name of the newly added contact
	 */
	function addContactRow(contact_name) {
		var newContact = makeContactRow(contact_name);
		$("#contacts").append(newContact);
		// assumes it's already sorted
		$('#contacts').find('div.contactRow').each(function(){
			if (this.id >= contact_name) {
				if (this.id > contact_name) {
					$(this).before(newContact);
				} else {
					if (!newContact.is(this)) {
						newContact.remove();
					}
				}
				return false;
			}
		});
		newContact.show('slow');
	}

	/*
	 * Removes the corresponding contact entry for the provided contact name
	 *
	 * @param contact_name: the name of the contact to be removed
	 */
	function removeContactRow(contact_name) {
		$('#contacts').find('div.contactRow').each(function() {
			if (this.id == contact_name) {
				$(this).hide('slow', function(){
					$(this).remove();
				});
			}
		});
	}

	/*
	 * Retrieves the contacts of a user based on their username and password and dynamically creates a contact list
	 */
	function get_contacts() {
		var contact_array = [];
		var len = localStorage.length;
		for (var i = 0; i < len; ++i)
		{
			try {
				var valueenc = localStorage.getItem(localStorage.key(i));
				decrypted = CryptoJS.AES.decrypt(valueenc, protectedpassword);
				decrypt1 = CryptoJS.enc.Utf8.stringify(decrypted);
				if (decrypt1)
					contact_array.push(decrypt1);
			} catch (err) {
				//not our contact
			}
		}
		contact_array.sort();
		contact_array = contact_array.filter(emptyElement);
		for(r=0;r<contact_array.length;r++)
		{
			addContactRow(contact_array[r]);
		}
		return contact_array;
	}

	function emptyElement(element) {
		if (element == null || element == 0 || element.toString().toLowerCase() == 'false' || element == '')
			return false;
		else return true;
	}

	/*
	 * Encrypts and adds a new contact to storage if the user provided a password during login
	 * Makes a call to add a contact row to the contact list for the new contact
	 *
	 * @param contact_name: the name of the contact to be added
	 */
	function add_contact(contact_name) {
		if (pwd)
		{
			var key = (username + contact_name + pwd);
			var hashed = CryptoJS.SHA3(key, {
				outputLength: 224
			});
			if (localStorage.getItem(hashed) === null)
			{
				var encrypted = CryptoJS.AES.encrypt(contact_name, protectedpassword);
				localStorage.setItem(hashed, encrypted);
			}
		}
		addContactRow(contact_name);
	}

	/*
	 * Searches the storage and removes the corresponding contact entry for the provided contact name if found
	 * Makes a call to remove the contact row of the provided contact name
	 *
	 * @param contact_name: the name of the contact to be removed
	 */
	function delete_contact(contact_name) {
		removeContactRow(contact_name);
		if (pwd) {
			var key = (username + contact_name + pwd);
			var hashed = CryptoJS.SHA3(key, {
				outputLength: 224
			});
			if (localStorage.getItem(hashed) != null) {
				localStorage.removeItem(hashed);
			}
		}
	}

	//Attempting to start a conversation with a contact
	function search_for_user() {
		if (connected) {
			endConversation(true);
		} else {
			$('#contacts>.contactRow.active').removeClass('active');
		}
		$('#' + uname + '.contactRow').addClass('active');
		if (privateUser) {
			if(uname<username)
				var conv_id2 = CryptoJS.MD5(uname+username + getNextTimeStamp());
			else
				var conv_id2 = CryptoJS.MD5(username+uname + getNextTimeStamp());
			var hashed_conv_id2= conv_id2.toString(CryptoJS.enc.Base64);
			if(uname<username)
				var conv_id1 = CryptoJS.MD5(uname+username + getTimeStamp());
			else
				var conv_id1 = CryptoJS.MD5(username+uname + getTimeStamp());
			var hashed_conv_id1 = conv_id1.toString(CryptoJS.enc.Base64);
			connect_to_private_user(hashed_conv_id1, hashed_conv_id2);
		}
		else {
			var myname = encrypt_simple(username, uname);
			var hash = CryptoJS.MD5(uname + getTimeStamp());
			var hashed_uname = hash.toString(CryptoJS.enc.Base64);
			connect_to_user(hashed_uname, myname);
		}
		their_initials = create_initials(uname);
		$("#chat_body").html('<section id="cd-timeline" class="cd-container"></section>');
		addMessage("Chat request sent", "lilac");
	}

	//Request Connection
	function connect_to_user(user, myname) {
		clientkeyx1 = get_key_pair();
		clientkeyx2 = get_key_pair();
		gx1 = clientkeyx1.publicKey;
		gx2 = clientkeyx2.publicKey;
		var exit_index = nodes[circuitLength-1];
		var data =
		{
			username: user,
			myusername: myname,
			gb: base16toHigh(gx1),
			gy: base16toHigh(gx2),
			address: 'http://' + creds[exit_index].host+':'+creds[exit_index].port
		};
		data = prepare_outgoing('request connection', data, circuitLength);
	}

	function connect_to_private_user(user1, user2) {
		clientkeyx1 = get_key_pair();
		clientkeyx2 = get_key_pair();
		gx1 = clientkeyx1.publicKey;
		gx2 = clientkeyx2.publicKey;
		var exit_index = nodes[circuitLength-1];
		var data =
		{
			username1: user1,
			username2: user2,
			gb: base16toHigh(gx1),
			gy: base16toHigh(gx2),
			address: 'http://' + creds[exit_index].host+':'+creds[exit_index].port
		};
		data = prepare_outgoing('request private connection', data, circuitLength);
	}

	//Disable chat
	function disableChat() {
		$("#chat_input_row").hide();
	}

	//Enable chat
	function enableChat() {
		$("#chat_input_row").show();
	}

	//Typing
	function isTyping() {
		var data;
		if ($("#chat_input").val() == '') {
			if (typing) {
				data = {typing: false};
				data = prepare_outgoing('partner typing', data, circuitLength);
				$("#sendMessage").prop("disabled",true);
			}
			typing = false;
		}
		else {
			if(!(typing)) {
				data = {typing: true};
				data = prepare_outgoing('partner typing', data, circuitLength);
				$("#sendMessage").prop("disabled",false);
			}
			typing = true;
		}
	}

	//Send Message
	function sendMessage(msg) {
		typing = false;
		default_chat_input_height();
		addMessage(msg, "me");
		var data = {msg: msg};
		data = prepare_outgoing('receive message', data, circuitLength);
	}

	//Add message to chat_body
	function addMessage(msg, type) {
		var msgClass = type;
		var initials = my_initials;
		if (type == "them") {
			var initials = their_initials;
		} else if (type == "lilac") {
			var msgClass = "them";
			var initials = lilac_initials;
		}
		time = (new Date()).toLocaleString();
		newMsg = $('<div name = ' + time + ' class="cd-timeline-block"><div class="cd-timeline-img is-hidden">' + initials + '</div><div class="cd-timeline-content ' + msgClass + ' is-hidden"><h6 style="line-height:1.5em;overflow-wrap: break-word; word-wrap: break-word">' + msg + '</h6><span class="cd-date">' + time + '</span></div></div>');
		$("#cd-timeline").append(newMsg);
		scrollDown();
		newMsg.find('.cd-timeline-img, .cd-timeline-content').removeClass('is-hidden').addClass('bounce-in');
	}

	//Reset SMP Modal
	function resetSMPmodal() {
		$("#question").prop("readonly", false);
		$("#question_div").show();
		$("#smpCancelButton").show();
		$("#question").val("");
		$("#passcode").val("");
	}

	//Reset SMP Failure Modal
	function resetSMPfailureModal() {
		$("#smpFailure-body").text("");
		$("#SMPfailFirst").slideDown();
		$("#SMPfailSecond").slideUp();
		$("#SMPfailThird").slideUp();
	}

	//Reset SMP Authentication Button
	function resetSMPbutton() {
		$('#smpAuthenticateButtonIcon').toggleClass("spinner", false);
		$('#smpAuthenticateButtonIcon').toggleClass("glyphicon glyphicon-remove-circle", false);
		$('#smpAuthenticateButtonIcon').toggleClass("glyphicon glyphicon-ok-circle", false);
		$('#smpAuthenticateButtonIcon').toggleClass("glyphicon glyphicon-lock", false);
		$('#smpAuthenticateButton').attr("data-mfb-label", "SMP");

		$('#smpAuthenticateButton').toggleClass("btn-success", false);
		$('#smpAuthenticateButton').toggleClass("btn-danger", false);
		$('#smpAuthenticateButton').toggleClass("btn-primary", false);
	}

	//Change SMP button back to defualt
	function defaultSMPbutton() {
		resetSMPbutton();
		$('#smpAuthenticateButton').toggleClass("btn-primary", true);
		$('#smpAuthenticateButtonIcon').toggleClass("glyphicon glyphicon-lock", true);
	}

	//Restore SMP button
	function restoreSMPbutton() {
		resetSMPbutton();
		$('#smpAuthenticateButton').toggleClass(smpButtonClass, true);
		$('#smpAuthenticateButtonIcon').toggleClass(smpButtonIconClass, true);
	}

	function compute_SMP_result(c, t, initiator) {
		resetSMPbutton();
		if (equals(c,t)) {
			$('#smpAuthenticateButton').toggleClass("btn-success", true);
			$('#smpAuthenticateButton').attr("data-mfb-label", "SMP Successful");
			$('#smpAuthenticateButtonIcon').toggleClass("glyphicon glyphicon-ok-circle", true);
			smpButtonClass = "btn-success";
			smpButtonIconClass = "glyphicon glyphicon-ok-circle";
			addMessage("SMP Successful!.", "lilac");
		} else {
			$('#smpAuthenticateButton').toggleClass("btn-danger", true);
			$('#smpAuthenticateButton').attr("data-mfb-label", "SMP Failed");
			$('#smpAuthenticateButtonIcon').toggleClass("glyphicon glyphicon-remove-circle", true);
			smpButtonClass = "btn-danger";
			smpButtonIconClass = "glyphicon glyphicon-remove-circle";
			addMessage("SMP Failed!", "lilac");
			if (initiator) {
				$("#smpFailure-body").text("Authentication with " + username + " failed.");
				$('#SMPfailureModal').modal({
					show: true,
					keyboard: false
				});
			}
		}
	}

	//End Conversation
	function endConversation(emit) {
		$('#contacts>.contactRow.active').removeClass('active');
		disableChat();
		if (emit)
		{
			data = {okay: 'okay'};
			data = prepare_outgoing('end conversation', data, circuitLength);
		}
		connected = false;
		acceptor = false;
		typing = false;
		chat_key = null;
	}

	function reset_ui() {
		//uname = null;
		$("#typing").hide();
		$("#chat_body").text(''); //Intro Text
		$("#chat_input").val('');
		$("#contacts").html('');
		defaultSMPbutton();
		resetSMPmodal();
		resetSMPfailureModal();
		disableChat();
	}

	//Logout
	function logout() {
		location.reload();
	}

	function array_is_full(arr) {
		var len = arr.length;
		for (var i = 0; i < len; i++)
		{
			if (!(i in arr))
			{
				return false;
			}
		}
		return true;
	}

	function padLeadingZeroes(str, len) {
		var zeroes = len - str.length;
		pad = "";
		while (zeroes > 0)
		{
			pad += "0";
			zeroes--;
		}
		return pad + str;
	}

	function base16toHigh(str) {
		var bInt = str2bigInt(str, 16);
		return bigInt2str(bInt, key_base);
	}

	function baseHighto16(str) {
		var bInt = str2bigInt(str, key_base);
		return padLeadingZeroes(bigInt2str(bInt, 16), 64).toLowerCase();
	}

	function increment_base64(a) {
		var i = a.length-1;
		var return_string = "";
		while (i > -1)
		{
			var val = base64_chars.indexOf(a.charAt(i));
			if (val != 63) {
				return_string = a.slice(0, i) + base64_chars[val+1] + return_string;
				i = -1;
			}
			else {
				return_string = base64_chars[0] + return_string;
				i--;
			}
		}
		return return_string;
	}

	function decrement_base64(a) {
		var i = a.length-1;
		var return_string = "";
		while (i > -1)
		{
			var val = base64_chars.indexOf(a.charAt(i));
			if (val != 0){
				return_string = a.slice(0, i) + base64_chars[val-1] + return_string;
				i = -1;
			}
			else {
				return_string = base64_chars[63] + return_string;
				i--;
			}
		}
		return return_string;
	}

	function decryptN(msg, sIDs, IVs, n) {
		for (var i = 0; i < n; i++) {
			msg = decrypt(msg, sIDs[i], IVs[i]);
			IVs[i] = decrement_base64(IVs[i]);
		}
		return msg;
	}

	function prepare_outgoing(type, content, num_nodes) {
		var plain_text_max_length = 140;
		var exceptions = ['gx', 'next-node', 'gx presence server', 'start chat', 'end conversation'];
		var exception_index = exceptions.indexOf(type);
		if (exception_index != -1) {
			//the correct message lenght to be padded to, depending on the number of missing encryption layers
			var adjusted_message_length = [140, 228, 348, 510];

			//missing at least one layer of encryption for the presence server/chat partner
			var missing_layers_of_encryption = 1;

			if (exception_index == 0 && num_nodes == 0) {
				//case for connecting with first node
				missing_layers_of_encryption += circuitLength - 1;
			}
			else if (exception_index <= 1) {
				//case for next-node: add the number of nodes still to be added
				missing_layers_of_encryption += circuitLength - num_nodes;
			}

			//adjust message length based on the number of missing layers of encryption
			plain_text_max_length = adjusted_message_length[missing_layers_of_encryption];
		}
		var return_data = {type: type, x: content};
		return_data = JSON.stringify(return_data);
		var len = return_data.length;
		var pieces = Math.ceil(len / plain_text_max_length);
		if (pieces > 63) {
			alert("Unable to send message: Too long");
			return;
		}
		for (var i = 0; i < pieces; i++) {
			var padding = "";
			var start_index = i * plain_text_max_length;
			var end_index = (i + 1) * plain_text_max_length;
			if (end_index > len)
			{
				padding = chance.string({length: (end_index - len), pool: base64_chars});
				end_index = len;
			}
			var msg = return_data.substring(start_index, end_index);
			msg = "" + base64_chars[i] + base64_chars[pieces] + msg + padding;
			prepare_outgoing_helper(type, msg, num_nodes);
		}
	}

	function prepare_outgoing_helper(type, msg, i) {
		var return_data = msg;
		var data, t;
		var once = false;
		var exceptions = ['gx', 'next-node', 'gx presence server', 'start chat', 'end conversation'];
		if (exceptions.indexOf(type) == -1) {
			var key = null, iv;
			if (connected)
			{
				key = chat_key;
				iv = chat_encrypt_iv;
			}
			else if (presence_server_key)
			{
				key = presence_server_key;
				iv = presence_server_encrypt_iv;
			}
			if (key)
			{
				data = return_data;
				return_data = encrypt(return_data, key, iv);
				once = true;
				if (connected)
				{
					chat_encrypt_iv = (acceptor) ? increment_base64(iv) : decrement_base64(iv);
				}
				else
				{
					presence_server_encrypt_iv = increment_base64(iv);
				}
			}
		}
		if (i == 0 && type == 'gx') {
			data = return_data;
			return_data = encrypt(return_data, creds[nodes[i]].publicKey, gx_IV);
			once=true;
		}
		while (i > 0) {
			data = return_data;
			if (once)
			{
				return_data = {type: 'x', x: data};
				return_data = JSON.stringify(return_data);
			}
			return_data = encrypt(return_data, sessionIDs[i-1], encrypt_relay_IVs[i-1]);
			encrypt_relay_IVs[i-1] = increment_base64(encrypt_relay_IVs[i-1]);
			i--;
			once = true;
		}
		data = return_data;
		return_data = {x: data};
		queue.push(return_data);
		return return_data;
	}

	function get_creds() {
		$('#main_loading').show();
		$.ajax({
			url: 'creds.json',
			dataType: 'json',
			success: function(data) {
				$.each(data, function(i, f) {
				    var cred = {
				        host: f.host,
				        port: f.port,
				        publicKey: f.publicKey
				    };
				    creds.push(cred);
				});
				setInterval(heartbeat, 1000); //heartbeat interval length in milliseconds
				buildCircuit();
			}
		})
	}

	function getSpam() {
		var spamData = chance.string({length: 682, pool: base64_chars}) + "==," + chance.string({length: 22, pool: base64_chars}) + "==";
		spamData = {x: spamData};
		return spamData;
	}

	function heartbeat() {
		if (client) {
			var msg = (typeof queue != "undefined" && queue != null && queue.length > 0) ? queue.shift() : getSpam();
			client.emit('x', msg);
			/*if (typeof queue != "undefined" && queue != null && queue.length > 0)
				client.emit('x', queue.shift());*/
		}
	}

	var locarray = [];
	//Build Circuit Code
	function buildCircuit() {
		var number_of_nodes = creds.length;
		nodes = [];
		var current_index = null;
		var message_length = null;
		var current_message = null;

		for (i=0; i<circuitLength; i++) {
			nodes.push(Math.floor(Math.random() * number_of_nodes));
		}
		i = 0;
		client = io.connect('http://' + creds[nodes[i]].host + ':' + creds[nodes[i]].port, {'forceNew': true });

		function emitgx() {
			console.log("Node: " + (i+1) + "\tAddress: " + 'http://' + creds[nodes[i]].host + ":"+ creds[nodes[i]].port);
			$("circuit").append("Node: " + (i+1) +"http://" + creds[nodes[i]].host+"<br>");
			$('#displaying').html('' + i*25 + '%');
			locarray.push(creds[nodes[i]].host);
			clientkeyx1 = get_key_pair();
			clientkeyx2 = get_key_pair();
			gx1 = clientkeyx1.publicKey;
			gx2 = clientkeyx2.publicKey;
			data =
			{
				gx1: base16toHigh(gx1),
				gx2: base16toHigh(gx2)
			};
			if (i == 0) data.client = true;
			data = prepare_outgoing('gx', data, i);
		}

		emitgx();

		client.on('x', function(data) {
			try {
				//we have keys to decrypt with
				if (i > 0) {
					data.x = decryptN(data.x, sessionIDs, decrypt_relay_IVs, i);
				}
				//we don't have all the keys, we should decrypt with the public key of the last relay
				//if (i < circuitLength)
				if (i == 0) {
					data.x = decrypt(data.x, creds[nodes[i]].publicKey, gx_IV);
				}
				//we are connected to a chat partner, so we should try decrypt with the chat partner key
				else if (connected) {
					try {
						var decrypted = decrypt(data.x, chat_key, chat_decrypt_iv);
						data.x = decrypted;
						chat_decrypt_iv = (acceptor) ? decrement_base64(chat_decrypt_iv) : increment_base64(chat_decrypt_iv);
					} catch (err) {
						try {
							//error decrypting with chat partner key, could be an end conversation message.
							var parsed = JSON.parse(data.x);
							if (parsed.hasOwnProperty('type') && parsed.type != 'conversation ended')
								return;
						} catch (err){
							//not an end conversation message.
							//Could be a message from presence server
							data.x = decrypt(data.x, presence_server_key, presence_server_decrypt_iv);
							presence_server_decrypt_iv = decrement_base64(presence_server_decrypt_iv);
						}
					}
				}
				//we are not connected to a partner, and we have a presence server key to decrypt with
				else if (presence_server_key) {
					try {
						var decrypted = decrypt(data.x, presence_server_key, presence_server_decrypt_iv);
						data.x = decrypted;
						presence_server_decrypt_iv = decrement_base64(presence_server_decrypt_iv);
					} catch (err) {
						//error decrypting with presence server partner key
						//if we are waiting for a chat partner, could be a 'connection accepted' message
						if (uname)
						{
							var parsed = JSON.parse(data.x);
							if (parsed.hasOwnProperty('type') && parsed.type != 'connection accepted')
								return;
						}
						else return;
					}
				}
				//we are receiving gy from the presence server, this is the only option left
				else if (i == circuitLength) {
					data.x = decrypt_simple(data.x, gx1);
				}
			} catch (err) {
				//decryption failed, most likely due to spam
				return;
			}
			try {
				//try parse the data straight away
				var temp = JSON.parse(data.x);
				data = temp;
			} catch (err) {
				//else it is a split message

				//handle current piece of the message
				current_index = base64_chars.indexOf((data.x).charAt(0));
				message_length = base64_chars.indexOf((data.x).charAt(1));
				current_message = (data.x).substring(2);
				//if it the last piece we need to remove any padding
				if ((current_index + 1) == message_length) {
					current_message = current_message.substring(0, current_message.lastIndexOf("}") + 1);
				}
				message_array[current_index] = current_message;

				//if we have received all the pieces we can stitch them and carry on
				if (message_array.length == message_length && array_is_full(message_array))	{
					data = message_array.join("");
					current_index = message_length = current_message = null;
					message_array.length = 0;
					try {
						//now try parsing the stitched data
						data = JSON.parse(data);
					} catch (err) {
						//could not parse
						return;
					}
				} else {
					//else we stop and wait for more pieces
					return;
				}
			}
			var type = data.type;
			data = data.x;
			switch (type)
			{
				case 'gy':
					var gy = baseHighto16(data.gy);
					var gb = creds[nodes[i]].publicKey;
					var csecret1 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx1.privateKey)), curve25519_from8bitString(h2s(gb))))), 16, 64);
					var csecret2 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx2.privateKey)), curve25519_from8bitString(h2s(gy))))), 16, 64);
					var cfinal = bigInt2str(mult(csecret1, csecret2), 16);
					var sessionid = cfinal;
					sessionIDs[i] = sessionid;
					encrypt_relay_IVs[i] = "AAAAAAAAAAAA";
					decrypt_relay_IVs[i] = "////////////";
					i++;
					//Connecting to next node
					if (i < circuitLength) {
						//if we're not at the last node, connect to the next node
						var nodeAddress = "http://" + creds[nodes[i]].host + ":" + creds[nodes[i]].port;
						data =
						{
							address: nodeAddress,
							key: base16toHigh(creds[nodes[i]].publicKey)
						};
						data = prepare_outgoing('next-node', data, i);
					} else {
						//else circuit established: connect to presence server
						$('#displaying').html('75%');
						clientkeyx1 = get_key_pair();
						clientkeyx2 = get_key_pair();
						gx1 = clientkeyx1.publicKey;
						gx2 = clientkeyx2.publicKey;
						data =
						{
							gx1: base16toHigh(gx1),
							gx2: base16toHigh(gx2)
						};
						data = prepare_outgoing('gx presence server', data, i);
					}
					break;
				case 'next-node-connected':
					emitgx();
					break;
				case 'gy presence server':
					$('#displaying').html('100%');
					var gy = baseHighto16(data.gy);
					var gb = baseHighto16(data.gb);
					var csecret1 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx1.privateKey)), curve25519_from8bitString(h2s(gb))))), 16, 64);
					var csecret2 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx2.privateKey)), curve25519_from8bitString(h2s(gy))))), 16, 64);
					var cfinal = bigInt2str(mult(csecret1, csecret2), 16);
					var sessionid = cfinal;
					presence_server_key = sessionid;
					presence_server_encrypt_iv = low_IV_start;
					presence_server_decrypt_iv = high_IV_start;

					//finished connected to relays and presence server
					//allow user to 'sign in'
					$('#myModal').modal({
						show: true,
						keyboard: false
					});
					$('#main_loading').hide();
					break;
				case 'presence registered':
					$("#username_loading").slideUp();
					$('#username_loading').toggleClass("loader", false);
					if (data.result) {
						welcome_user();
					}
					else {
						$("#username_form").slideDown();
						$('#username_taken').slideDown();//.delay(2000).slideUp();
					}
					break;
				case 'connection requested':
					if(privateUser) {
						if(uname<username) {
							var conv_id = CryptoJS.MD5(uname+username+getTimeStamp());
						} else {
							var conv_id = CryptoJS.MD5(username+uname+getTimeStamp());
						}
						var hashed_conv_id = conv_id.toString(CryptoJS.enc.Base64);
						if (hashed_conv_id == data.username) {
							newData = data;
							$('#accept_new_partner').trigger('click');
						}
					} else {
						uname = decrypt_simple(data.username, username);
						//Ask user to accept/decline connection
						$("#new_partner_request").text("You have a chat request from " + uname + ".");
						$("#new_partner_alert").slideDown();
						newData = data;
					}
					break;
				case 'connection accepted':
					if (decrypt_simple(data.username, username) == uname) {
						var gb = baseHighto16(data.gb);
						var gy = baseHighto16(data.gy);
						var csecret1 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx1.privateKey)), curve25519_from8bitString(h2s(gb))))), 16, 64);
						var csecret2 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx2.privateKey)), curve25519_from8bitString(h2s(gy))))), 16, 64);
						var cfinal = bigInt2str(mult(csecret1, csecret2), 16);
						chat_key = cfinal;
						chat_encrypt_iv = "////////////";
						chat_decrypt_iv = "AAAAAAAAAAAA";
						h = str2bigInt(chat_key, 16, 32);
						connected = true;
						acceptor = false;
						var data = {filler: "filler"};
						data = prepare_outgoing('chat connected', data, circuitLength);
						addMessage('Chat partner connected. Please secure your session with a passphrase (SMP) with your chat partner. You can read more about the Socialist Millionaire Protocol(SMP) <a href="https://en.wikipedia.org/wiki/Socialist_millionaire" target="_blank">here</a>.', "lilac");
						enableChat();
						//warn SMP
					} /*else {
						endConversation(true);
						alert ("Conversation ended because a secure connection could not be established");
					}*/
					break;
				case 'chat connected':
					addMessage('Chat partner connected. Please secure your session with a passphrase (SMP) with your chat partner. You can read more about the Socialist Millionaire Protocol(SMP) <a href="usage.html" target="_blank">here</a>.', "lilac");
					enableChat();
					//warn SMP
					break;
				case 'partner typing':
					if (data.typing) {
						$("#typing").show();
					} else {
						$("#typing").hide();
					}
					break;
				case 'receive message':
					var msg = data.msg;
					addMessage(msg, "them");
					$("#typing").hide();
					break;
				case 'SMP':
					switch (data.status) {
						case "Initiation":
							newData = data;
							//show modal showing question and asking for passphrase
							$("#smp-body").text(uname+" has asked you to verify your identity. Please enter the matching passcode.");
							$("#smpCancelButton").hide();
							if ((data.question).replace(/\s/g, '').length) {
								$("#question").prop("readonly", true);
								$("#question").val(data.question);
							} else {
								$("#question_div").hide();
							}
							$('#SMPmodal').modal({
								show: true,
								keyboard: false
							});
							break;
						case "P":
							var h_b = str2bigInt(data.h_b, 95, 32);
							g = powMod(h_b, a, modp);
							var h_beta = str2bigInt(data.h_beta, 95, 32);
							gamma = powMod(h_beta, alpha, modp);

							p = powMod(gamma, r, modp);
							q = str2bigInt(data.q, 95, 32);

							t = multMod(p, inverseMod(q,modp), modp);

							var h_r = powMod(h,r,modp);
							var g_x = powMod(g, passcode, modp);
							pBar = multMod(h_r, g_x, modp);

							var data = {status: "PBar", q: bigInt2str(p, 95), qBar: bigInt2str(pBar, 95)};
							data = prepare_outgoing('SMP', data, circuitLength);
							break;

						case "PBar":
							q = str2bigInt(data.q, 95, 32);

							t = multMod(p, inverseMod(q,modp), modp);

							var h_r = powMod(h,r,modp);
							var g_x = powMod(g, passcode, modp);
							pBar = multMod(h_r, g_x, modp);
							qBar = str2bigInt(data.qBar, 95, 32);

							var q_p_inverse = multMod(qBar, inverseMod(pBar,modp), modp);
							var base = powMod(q_p_inverse, alpha, modp);

							var data = {status: "Base", qBar: bigInt2str(pBar, 95), base: bigInt2str(base, 95)};
							data = prepare_outgoing('SMP', data, circuitLength);
							break;

						case "Base":
							qBar = str2bigInt(data.qBar, 95, 32);

							var base = str2bigInt(data.base, 95, 32);

							c = powMod(base, alpha, modp);

							var q_p_inverse = multMod(qBar, inverseMod(pBar,modp), modp);
							var base = powMod(q_p_inverse, alpha, modp);

							var data = {status: "C", base: bigInt2str(base, 95)};
							data = prepare_outgoing('SMP', data, circuitLength);
							compute_SMP_result(c, t, true);
							break;
						case "C":
							var base = str2bigInt(data.base, 95, 32);
							c = powMod(base, alpha, modp);
							compute_SMP_result(c, t, false);
							break;
					}
					break;
				case 'conversation ended':
					endConversation(false);
					addMessage("Your chat partner ended the conversation.", "lilac");
					break;
			}
		});
		client.on('disconnect', function(data) {
			endConversation(false);
			addMessage("Connection has been lost. Please reload the page.", "lilac");
		});
	}

	$("#usernameButton").on('click' , function(){
		username = sanitizeHtml($('#username').val());
		$("#hereusername").html(username);
		if (username.replace(/\s/g, '').length) {
			if ($('#password').val().length) {
				pwd = CryptoJS.SHA3( $('#password').val(),
				{
					outputLength: 224
				});
			}
			protectedpassword = (username + pwd);
			$("#username").val('');
			$("#password").val('');
			privateUser = !($("#private").prop('checked'));
			$("#username_form").slideUp();
			if (!privateUser) {
				$('#username_loading').toggleClass("loader", true);
				$("#username_loading").slideDown();
				var hash = CryptoJS.MD5(username + getNextTimeStamp());
				var hashed_username_2 = hash.toString(CryptoJS.enc.Base64);
				hash = CryptoJS.MD5(username + getTimeStamp());
				var hashed_username_1 = hash.toString(CryptoJS.enc.Base64);
				register_presence(hashed_username_1, hashed_username_2);
			} else {
				welcome_user();
			}
		} else {
			alert("Enter a valid username to continue");
		}
	});
	$("#search").on('click' , function() {
		var new_contact = sanitizeHtml($("#search_username").val());
		if (new_contact.replace(/\s/g, '').length) {
			add_contact(new_contact);
			$("#search_username").val('');
		}
	});
	$("#accept_new_partner").on('click' , function() {
		$("#new_partner_alert").slideUp();
		if (connected) {
			endConversation(true);
		}
		add_contact(uname);
		$('#' + uname + '.contactRow').addClass('active');
		clientkeyx1 = get_key_pair();
		clientkeyx2 = get_key_pair();
		gx1 = clientkeyx1.publicKey;
		gx2 = clientkeyx2.publicKey;
		var myname = encrypt_simple(username, uname);
		var data = {
			username : myname,
			gb : base16toHigh(gx1),
			gy : base16toHigh(gx2),
			address : newData.address,
			pid : newData.Xpid
		};
		data = prepare_outgoing('start chat', data, circuitLength);
		connected = true;
		acceptor = true;
		var gb = baseHighto16(newData.gb);
		var gy = baseHighto16(newData.gy);
		var csecret1 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx1.privateKey)), curve25519_from8bitString(h2s(gb))))), 16, 64);
		var csecret2 = str2bigInt(straight_hex(curve25519_to8bitString(curve25519(curve25519_from8bitString(h2s(clientkeyx2.privateKey)), curve25519_from8bitString(h2s(gy))))), 16, 64);
		var cfinal = bigInt2str(mult(csecret1, csecret2), 16);
		chat_key = cfinal;
		chat_encrypt_iv = "AAAAAAAAAAAA";
		chat_decrypt_iv = "////////////";
		h = str2bigInt(chat_key, 16, 32);
		their_initials = create_initials(uname);
		$("#chat_body").html('<section id="cd-timeline" class="cd-container"></section>');
		addMessage("Chat request accepted", "lilac");
	});
	$("#decline_new_partner").on('click' , function() {
		$("#new_partner_alert").slideUp();
	});
	$('#upload_contacts').on("click", function() {
		$('#contacts_modal').modal('show');
	});
	$('#maps_modal_pop').on("click", function() {
		$('#mapmodal').modal('show');
		//initiliaze map
		initialize();
	});
	$('#logoutButton').on("click", function() {
		logout();
	});
function loadScript() {
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = 'https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&' + 'callback=initialize';
	document.body.appendChild(script);
}

function initialize() {
    // Through Ip address, Locate on google map
    function ipAddressLocator() {
        var ipAddress = locarray;
        var url = {};

        var infoIpAddress = [];
        var geocoder = new google.maps.Geocoder();
        for (var ipAd = 0; ipAd < ipAddress.length; ipAd++) {
            url[ipAd] = "http://ipinfo.io/" + ipAddress[ipAd];

            $.ajax({
                type: "Get",
                url: url[ipAd],
                param: '{}',
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                async: false,
                success: function (response) {
                    infoIpAddress.push({ "Lat": response.loc.split(',')[0], "Lng": response.loc.split(',')[1], "City": response.city, "Region": response.region });
                }
            }).responseText;

        }
        showMap(infoIpAddress);
    }

    function showMap(IpAddressLoc) {
        window.map = new google.maps.Map(document.getElementById('map'), {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            zoomControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM
        }
          });
          var infowindow = new google.maps.InfoWindow();
          var bounds = new google.maps.LatLngBounds();
          var i=0;
             while (pp=IpAddressLoc.pop()) {
                 marker = new google.maps.Marker({
                     position: new google.maps.LatLng(pp["Lat"], pp["Lng"]),
                     map: map
                 });

                 bounds.extend(marker.position);

                 google.maps.event.addListener(marker, 'click', (function (marker, i) {
                     return function () {
                         infowindow.setContent(pp["Region"]+ " "+ pp["Region"]);
                         infowindow.open(map, marker);
                     }
                 })(marker, i));
                 i++;
             }
            map.fitBounds(bounds);

     }


    //Through Location, locate and mark on google map
    function locationLatLng() {
        var locations = [];
        window.map = new google.maps.Map(document.getElementById('map'), {
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        var infowindow = new google.maps.InfoWindow();
        var bounds = new google.maps.LatLngBounds();

        for (i = 0; i < locations.length; i++) {

            marker = new google.maps.Marker({
                position: new google.maps.LatLng(locations[i][1], locations[i][2],locations[i][0]),
                map: map
            });

            bounds.extend(marker.position);
            google.maps.event.addListener(marker, 'click', (function (marker, i) {
                return function () {
                    infowindow.setContent(locations[i][0]);
                    infowindow.open(map, marker);
                }
            })(marker, i));
        }
        map.fitBounds(bounds);
    }
    ipAddressLocator();
}
window.onload = loadScript;
///////////maps/////////////
	$("#sendMessage").on('click' , function() {
		validateMessage();
	});
	function validateMessage(){
		var msg = sanitizeHtml($("#chat_input").val());
		if (msg.replace(/\s/g, '').length > 0 && msg.replace(/\s/g, '').length <= 140) {
			msg = msg.replace(/\r?\n/g, '<br>');
			$("#chat_input").val('');
			sendMessage(msg);
		} else {
			//alert("Invalid input!");
		}
	}
	$("#endConversation").on('click' , function() {
		addMessage("You ended the conversation.", "lilac");
		endConversation(true);
	});
	$('#chat_input').on('input', function() {
		isTyping();
	});
	$('#smpAuthenticateButton').on('click' , function() {
		if (!$('#smpAuthenticateButtonIcon').hasClass("spinner")) {
			initiated = true;
			$("#smp-body").text("Enter a passcode which  "+uname+" will have to enter to confirm his/her identity. You may also add an optional question as a hint.");
			//show modal asking for question (optional) and passphrase
			$('#SMPmodal').modal({
				show: true,
				keyboard: false
			});
		}
	});
	$('#smpButton').on('click' , function() {
		var _chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
		$('#SMPmodal').modal('hide');
		resetSMPbutton();
		$('#smpAuthenticateButtonIcon').toggleClass("spinner", true);
		$('#smpAuthenticateButton').toggleClass("btn-primary", true);
		$('#smpAuthenticateButton').attr("data-mfb-label", "SMP in Progress");
		question = $("#question").val();
		var x_string = $("#passcode").val();
		var hash = CryptoJS.SHA3(x_string);
		var x_hash = hash.toString();
		passcode = str2bigInt(x_hash, 16, 32);
		a = str2bigInt(chance.string({length: 35, pool: _chars}), 95, 32);
		alpha = str2bigInt(chance.string({length: 35, pool: _chars}), 95, 32);
		r = str2bigInt(chance.string({length: 35, pool: _chars}), 95, 32);
		var h_a = powMod(h,a,modp);
		var h_alpha = powMod(h,alpha,modp);
		addMessage("SMP Initiated.", "lilac");
		resetSMPmodal();
		if (initiated) {
			initiated = false;

			var data = {status: "Initiation", question: question, h_b: bigInt2str(h_a, 95), h_beta: bigInt2str(h_alpha, 95)};
			data = prepare_outgoing('SMP', data, circuitLength);
		} else {
			var h_b = str2bigInt(newData.h_b, 95, 32);
			g = powMod(h_b, a, modp);
			var h_beta = str2bigInt(newData.h_beta, 95, 32);
			gamma = powMod(h_beta, alpha, modp);

			p = powMod(gamma, r, modp);
			var data = {status: "P", h_b: bigInt2str(h_a, 95), h_beta: bigInt2str(h_alpha, 95), q: bigInt2str(p, 95)};
			data = prepare_outgoing('SMP', data, circuitLength);
		}
	});
	$('#smpCancelButton').on('click' , function() {
		if (initiated)
		{
			initiated = false;
			$('#SMPmodal').modal('hide');
		}
	});
	$('#smpEndButton').on('click' , function() {
		$('#SMPfailureModal').modal('hide');
		endConversation(true);
		addMessage("You ended the conversation.", "lilac");
	});
	$('#smpRetryButton').on('click' , function() {
		resetSMPfailureModal();
		$('#SMPfailureModal').modal('hide');
		initiated = true;
		$("#smp-body").text("Enter a passcode which "+uname+" will have to enter to confirm his/her identity. You may also add an optional question as a hint.");
		$('#SMPmodal').modal({
			show: true,
			keyboard: false
		});
	});
	$('#smpMoreButton').on('click' , function() {
		$("#SMPfailSecond").slideDown();
	});
	$('#smpContinueButton').on('click' , function() {
		$("#SMPfailSecond").slideUp();
		$("#SMPfailFirst").slideUp();
		$("#SMPfailThird").slideDown();
	});
	$('#smpNoButton').on('click' , function() {
		$("#SMPfailThird").slideUp();
		$("#SMPfailFirst").slideDown();
	});
	$('#smpYesButton').on('click' , function() {
		$('#SMPfailureModal').modal('hide');
		resetSMPfailureModal();
	});
	$('#contacts').on('click', '.delete-contact', function() {
		var contact = this.id;
		delete_contact(contact);
	});
	$('#contacts').on('click', '.message-contact', function() {
		uname = this.id;
		search_for_user();
	});
});
