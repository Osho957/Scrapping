// node main.js --excel=Worldcup.csv --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --dataFolder=WorldCup


const fs = require("fs");
const minimist = require("minimist");
const axios = require("axios");
const jsdom = require("jsdom");
const excel = require("excel4node");
const pdf = require("pdf-lib");
const path = require("path");
let count = 0;

let args =  minimist(process.argv);

let resPromise = axios.get(args.source);
resPromise.then(function(response){
    if(response.statusCode==404){
        return;
    }
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matchDivs = document.querySelectorAll("div.match-score-block");
    let matches=[];
    for(let i=0;i<matchDivs.length;i++){
        let matchdiv = matchDivs[i];
        let match={
              t1: "",
              t2: "",
              t1s: "",
              t2s: "",
              result: ""
        }

        let teamParas = matchdiv.querySelectorAll("div.name-detail > p.name");
        match.t1 = teamParas[0].textContent;
        match.t2 = teamParas[1].textContent;

        let scoreSpans = matchdiv.querySelectorAll("div.score-detail > span.score");
        if (scoreSpans.length == 2) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        } else if (scoreSpans.length == 1) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }

        let resultSpan = matchdiv.querySelector("div.status-text > span");
        match.result = resultSpan.textContent;

        matches.push(match);

    }
   let matchesJSON = JSON.stringify(matches);
   fs.writeFileSync("matches.json",matchesJSON,"utf-8");
   
   let teams = [];
   // fill all the teams uniquely 
   for(let i=0;i<matches.length;i++){
     fillteams(teams,matches[i].t1);
     fillteams(teams,matches[i].t2);
   }
 // fill all corresponding matches
   for(let i=0;i<matches.length;i++){
    fillMatches(teams,
        matches[i].t1,
        matches[i].t2,
        matches[i].t1s,
        matches[i].t2s,
        matches[i].result);

    fillMatches(teams,
        matches[i].t2,
        matches[i].t1,
        matches[i].t2s,
        matches[i].t1s,
        matches[i].result);
  }

   let teamJSON = JSON.stringify(teams);
   fs.writeFileSync("team.json",teamJSON,"utf-8");
   
   createExcelFile(teams);
   createFolders(args.dataFolder,teams);

})

function createFolders(dataDir,teams){
    if(fs.existsSync(dataDir)==true){
        fs.rmdirSync(dataDir, { recursive: true })
    }
    fs.mkdirSync(dataDir);
    for(let i=0;i<teams.length;i++){
        let teamFolderName = path.join(dataDir,teams[i].name);
        if(fs.existsSync(teamFolderName)==false){
            fs.mkdirSync(teamFolderName);
        }
        for (let j = 0; j < teams[i].matches.length; j++) {
       let match = teams[i].matches[j];
       createScoreCard(teamFolderName,teams[i].name,match);
        }
    }
}

function createScoreCard(teamFolderName,homeTeam,match){
    count =0;
    let matchFileName = path.join(teamFolderName,match.vs);
     let templateByte = fs.readFileSync("Template.pdf");
     let pdfDocPromise = pdf.PDFDocument.load(templateByte);
     pdfDocPromise.then(function(pdfDoc){
         let page = pdfDoc.getPage(0);

         page.drawText(homeTeam,{
             x:320,
             y:727,
             size:8,
             
         });
         page.drawText(match.vs,{
            x:320,
            y:712,
            size:8,
          
        });
        page.drawText(match.selfScore,{
            x:320,
            y:697,
            size:8,
          
        });
        page.drawText(match.oppScore,{
            x:320,
            y:683,
            size:8,
            
        });
        page.drawText(match.result,{
            x:320,
            y:669,
            size:8,
           
        });
        let changedByteSave = pdfDoc.save();
        changedByteSave.then(function(changedByte){
          if(fs.existsSync(matchFileName+".pdf")==true){
              fs.writeFileSync(matchFileName+count+".pdf",changedByte);
              count++;
          }else{
              fs.writeFileSync(matchFileName+".pdf",changedByte)
          }
        })
     })
}

function createExcelFile(teams){
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("VS");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opp Score");
        sheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(args.excel);
}

function fillMatches(teams,homeTeam,oppTeam,selfScore,oppScore,result){
    let tidx =-1;
    for(let j=0;j<teams.length;j++){
        if(teams[j].name==homeTeam){
            tidx =j;
            break;
        }
    }
    let team = teams[tidx];
    team.matches.push({
    vs:oppTeam,
    selfScore:selfScore,
    oppScore:oppScore,
    result: result
    })
}

function fillteams(teams,teamName){
    let tidx =-1;
    for(let j=0;j<teams.length;j++){
        if(teams[j].name==teamName){
            tidx =j;
            break;
        }
    }
    if(tidx==-1){
        let team = {
            name:teamName,
            matches:[]
        }
        teams.push(team);
    }
}
