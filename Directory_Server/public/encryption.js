function strip(a){
	a = JSON.parse(a);
	return a.ct+","+a.salt;
}

function dress(s, iv){
	s = s.split(",");
	a = {};
	a.v = 1;
	a.iter = 1000;
	a.ks = 128;
	a.ts = 64;
	a.mode = "gcm";
	a.adata = "";
	a.cipher = "aes";
	a.ct = s[0];
	a.salt = s[1];
	a.iv = iv;
	a = JSON.stringify(a);
	return a;
}

function decrypt(msg, sID, IV)
{
	msg = dress(msg, IV);
	return sjcl.decrypt(sID, msg);
}

function encrypt(msg, sID, IV)
{
	var encrypted = sjcl.encrypt(sID, msg, {mode : "gcm", iv: IV});
	return strip(encrypted);
}

function strip_simple(a){
	a = JSON.parse(a);
	return a.ct+","+a.salt+","+a.iv;
}

function dress_simple(s){
	s = s.split(",");
	a = {};
	a.v = 1;
	a.iter = 1000;
	a.ks = 128;
	a.ts = 64;
	a.mode = "gcm";
	a.adata = "";
	a.cipher = "aes";
	a.ct = s[0];
	a.salt = s[1];
	a.iv = s[2];
	a = JSON.stringify(a);
	return a;
}

function decrypt_simple(msg, sID)
{
	msg = dress_simple(msg);
	return sjcl.decrypt(sID, msg);
}

function encrypt_simple(msg, sID)
{
	var encrypted = sjcl.encrypt(sID, msg, {mode : "gcm"});
	return strip_simple(encrypted);
}
