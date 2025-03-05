// // load saved data when popup is opened
// document.addEventListener('DOMContentLoaded', () => {
//   console.log("loading saved input...");
//   chrome.storage.local.get(['sheetLink'], (data) => {
//     if (data.sheetLink) {
//       document.getElementById('sheetLink').value = data.sheetLink;
//     }
//   });
// });

// // save sheet link before closing the popup
// window.onbeforeunload = () => {
//   const sheetLink = document.getElementById('sheetLink').value.trim();
//   console.log('saving input: ', sheetLink);
//   chrome.storage.local.set({
//     sheetLink: sheetLink,
//   });
// };

document.getElementById("highlightButton").addEventListener("click", () => {
  const sheetLink = document.getElementById('sheetLink').value.trim();
  const errorMessage = document.getElementById('errorMessage');

  // check for valid sheet link
  if (!sheetLink) {
    errorMessage.textContent = "Please fill in the sheet link.";
    return;
  }

  errorMessage.textContent = ""; // clear error message if input is valid

  const sheetId = sheetLink.match(/\/d\/(.*?)\//);
  if (!sheetId) {
    errorMessage.textContent = "Invalid Google Sheets URL.";
    return;
  }
  
  const url = `https://docs.google.com/spreadsheets/d/${sheetId[1]}/gviz/tq?tqx=out:csv`;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: highlightInternships,
          args: [url]
      });
  });
});

async function highlightInternships(url) {
  try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`failed to fetch data: ${response.statusText}`);

      const csvData = await response.text();
    
      // parse CSV data into rows
      const rows = csvData.split("\n")
        .map(row => {
          // convert to lowercase & remove special chars
          const cleanRow = row.replace(/^"|"$/g, '').split('","');
          return cleanRow.map(cell => cell.trim());
        })
        .filter(row => row.length >= 3);
	      
      // debug: log parsed rows
      console.log("Parsed Rows:", rows);
      
      // create set: {company: role: location} for lookup (case-insensitive)
      const appliedInternships = new Set(
          rows.map(row => {
            const companyName = row[0] ? row[0].replace(/['"]+/g, "").trim().toLowerCase() : ''; 
            const role = row[1] ? row[1].replace(/['"]+/g, "").trim().toLowerCase() : '';
            const location = row[2] ? row[2].replace(/['"]+/g, "").trim().toLowerCase() : '';
            return `${companyName}|${role}|${location}`; // combine company, role, and location
          })
      );
     
      // debug: log applied internships
      console.log("Applied Internships:", appliedInternships);
      
      // all internship rows (tr)
      const internshipRows = document.querySelectorAll("tr");
      let lastValidCompany = ""; // keep track of the last valid name
      let lastValidLocation = ""; // keep track of the last valid location

      internshipRows.forEach(row => {
          const internshipLink = row.querySelector("td a"); // find link in the row
          const roleCell = row.querySelector("td:nth-child(2)"); // get role from 2nd column
          const locationCell = row.querySelector("td:nth-child(3)"); // get location from 3rd column

          if (internshipLink && roleCell && locationCell) {
            // convert to lowercase
            let companyName = internshipLink.textContent.replace(/['"]+/g, "").trim().toLowerCase();
            const role = roleCell.textContent.replace(/['"]+/g, "").trim().toLowerCase();
            let location = locationCell.textContent.replace(/['"]+/g, "").trim().toLowerCase();

            // if company name is empty or missing, use last valid company name
            if (!companyName) {
                companyName = lastValidCompany; // use previous valid company name
            } else {
                lastValidCompany = companyName; // update last valid company if valid company name
            }

            // if location is empty or missing, use last valid location
            if (!location) {
                location = lastValidLocation; // use previous valid location
            } else {
                lastValidLocation = location; // update last valid location if valid location
            }

            const key = `${companyName}|${role}|${location}`; // combine company, role, and location for lookup
			
            // debug logging
            console.log(`Checking: Company - ${companyName}, Role - ${role}, Location - ${location}, Key: ${key}`);
         
            if (appliedInternships.has(key)) {
                row.style.backgroundColor = "green"; // applied
                row.title = "Applied";
            } else {
                row.style.backgroundColor = "red"; // not applied
                row.title = "Not Applied";
            }
          }
      });
  } catch (error) {
      console.error("error fetching or processing data:", error);
      alert("failed to load internship application statuses.");
  }
}
