import http from "http";
import FormData from "form-data";

const FILESERVICE_URL = "http://identifier/api/files/";

//Create a random filename and content and upload.
async function saveFile() {
  let filename    = generateRandomContent(1);
  let filecontent = generateRandomContent(30);
  
  let form = new FormData();
  form.append("file", Buffer.from(filecontent), {
    filename: filename,
    contentType: "text/plain"
  });

  return new Promise((resolve, reject) => {
    form.submit(FILESERVICE_URL, (err, res) => {
      console.log("Inside the response callback of the new form-data method. Responsecode:", res.statusCode);
      resolve(res);
    });
  });
}

////Apparently, the library uses some dark magic, because making a manual request like this does not work.
//async function saveFile() {
//  let filename    = generateRandomContent(1);
//  let filecontent = generateRandomContent(30);
//
//  //Prepare data
//  let boundary = "-----------------------------11166788396036188132465557338";
//  let formBody = [];
//
//  //formBody.push(`${boundary}\r\n`);
//  //formBody.push(`Content-Disposition: form-data; name="Content-Type"\r\n\r\n`);
//  //formBody.push(`text/plain\r\n`);
//  formBody.push(`${boundary}\n`);
//  formBody.push(`Content-Disposition: form-data; name="file"; filename="${filename}"\n`);
//  formBody.push(`Content-Type: application/octet-stream\n\n`);
//  formBody = formBody.join("");
//
//  let payload = Buffer.concat([
//    Buffer.from(formBody,          "utf8"),
//    Buffer.from(filecontent,       "binary"),
//    Buffer.from(`\n${boundary}--`, "utf8")
//  ]);
//  let postData = payload.toString();
//
//  console.log("PAYLOAD:\n", `${postData}`);
//
//  let options = {
//    method:   "POST",
//    headers: {
//      //"Content-Type":   `multipart/form-data; boundary=${boundary}`,
//      "Content-Type":   "text/plain",
//      "Content-Length": Buffer.byteLength(payload),
//      "X-Rewrite-URL":  "http://producertest/"
//    }
//  };
//
//  return new Promise((resolve, reject) => {
//
//    let req = http.request(FILESERVICE_URL, options);
//
//    req.on("response", (res) => {
//      res.on("data", (data) => console.log);
//      res.on("end", () => {
//        console.log("Finished posted data to the syncfile service for storage, statuscode:", res.statusCode);
//        resolve();
//      });
//    });
//
//    req.on("error", (err) => {
//      console.error("Posting the delta file to the syncfile services failed! Error message:", err);
//      reject(err);
//    });
//
//    req.on("abort", () => {
//      console.log("Request aborted!");
//      reject("Request aborted");
//    });
//    req.write(postData);
//    req.end();
//    console.log("Will send file to the syncfile service", JSON.stringify(req.outputData));
//  });
//}

function generateRandomContent(nwords) {
  let word, wordlength, content;
  content        = [];
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charlength = characters.length;
  
  for (let i = 0; i < nwords; i++) {
    wordlength = Math.random() * 20;
    word = [];
    for (let j = 0; j < wordlength; j++) {
      word.push(characters.charAt(Math.floor(Math.random() * charlength)));
    }
    content.push(word.join(""));
  }
    
  return content.join(" ");
}

export {
  saveFile
}
