#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { execSync } = require('child_process');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// Find all README files
function findReadmeFiles(excludeTestFixtures = true) {
  try {
    let command = 'find . -name "README.md" -type f | grep -v node_modules';
    if (excludeTestFixtures) {
      command += ' | grep -v "/test/fixtures/"';
    }
    command += ' | sort';
    
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return result.split('\n').filter(line => line.trim());
  } catch (error) {
    console.error('Error finding README files:', error.message);
    return [];
  }
}

// Regular expressions to find links
const linkPatterns = [
  /\[([^\]]+)\]\(([^)]+)\)/g,  // Markdown links [text](url)
  /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,  // Direct URLs
  /href="([^"]+)"/g,  // HTML href attributes
  /src="([^"]+)"/g   // HTML src attributes
];

// Extract links from files
function extractLinks(readmeFiles) {
  const allLinks = new Map(); // Map of URL -> Array of {file, line}
  
  for (const readmePath of readmeFiles) {
    if (!fs.existsSync(readmePath)) continue;
    
    const content = fs.readFileSync(readmePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Skip lines that are likely code blocks
      if (line.trim().startsWith('```') || line.trim().startsWith('    ')) return;
      
      for (const pattern of linkPatterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        
        while ((match = pattern.exec(line)) !== null) {
          let url = match[2] || match[1] || match[0];
          
          // Clean up URL - remove trailing punctuation that's not part of the URL
          url = url.trim().replace(/[,;.)\]]+$/, '');
          
          // Skip certain patterns
          if (url.startsWith('#') ||  // Anchor links
              url.startsWith('mailto:') ||  // Email links
              url.includes('localhost') ||  // Local development URLs
              url.includes('127.0.0.1') ||  // Local IPs
              url.includes('example.com') ||  // Example domains
              url === '.' || url === '..' ||  // Relative paths
              url.startsWith('$') ||  // Variables
              url.includes('${') ||  // Template literals
              !url) {
            continue;
          }
          
          // Handle relative links
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            // Check if it's a file path
            if (url.startsWith('./') || url.startsWith('../') || !url.includes('://')) {
              // This is a relative file path, validate it exists
              const absolutePath = path.resolve(path.dirname(readmePath), url);
              if (!allLinks.has(`file://${absolutePath}`)) {
                allLinks.set(`file://${absolutePath}`, []);
              }
              allLinks.get(`file://${absolutePath}`).push({
                file: readmePath,
                line: lineIndex + 1
              });
              continue;
            }
          }
          
          // Add to links collection
          if (!allLinks.has(url)) {
            allLinks.set(url, []);
          }
          allLinks.get(url).push({
            file: readmePath,
            line: lineIndex + 1
          });
        }
      }
    });
  }
  
  return allLinks;
}

// Function to check HTTP(S) links
function checkHttpLink(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        method: 'HEAD',
        timeout: 5000, // Reduced timeout for faster checking
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Platformatic-Link-Checker/1.0)'
        }
      };
      
      const req = client.request(url, options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Check the redirect location
          checkHttpLink(res.headers.location).then(resolve);
        } else if (res.statusCode === 404) {
          resolve({ ok: false, status: res.statusCode, reason: 'Not Found (404)' });
        } else if (res.statusCode >= 200 && res.statusCode < 400) {
          // For Docusaurus sites, we need to check content for "Page Not Found"
          if (url.includes('docs.platformatic.dev')) {
            // Do a GET request to check content
            const getReq = client.get(url, { 
              timeout: 5000, // Reduced timeout
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Platformatic-Link-Checker/1.0)'
              }
            }, (getRes) => {
              let body = '';
              getRes.on('data', chunk => body += chunk);
              getRes.on('end', () => {
                // Check for specific Docusaurus 404 page indicators
                if (body.includes('<title>Page Not Found') ||
                    body.includes('This page could not be found') ||
                    body.includes('We could not find what you were looking for') ||
                    (body.includes('404') && body.includes('Page Not Found'))) {
                  resolve({ ok: false, status: 200, reason: 'Page shows "Not Found" content' });
                } else {
                  resolve({ ok: true, status: res.statusCode });
                }
              });
            });
            getReq.on('error', () => {
              resolve({ ok: true, status: res.statusCode }); // Assume OK if can't get content
            });
            getReq.on('timeout', () => {
              getReq.destroy();
              resolve({ ok: true, status: res.statusCode }); // Assume OK if timeout
            });
          } else {
            resolve({ ok: true, status: res.statusCode });
          }
        } else {
          resolve({ ok: false, status: res.statusCode, reason: `HTTP ${res.statusCode}` });
        }
      });
      
      req.on('error', (err) => {
        resolve({ ok: false, status: 0, reason: err.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0, reason: 'Timeout' });
      });
      
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, reason: err.message });
    }
  });
}

// Function to check file links
function checkFileLink(url) {
  const filePath = url.replace('file://', '');
  return new Promise((resolve) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        resolve({ ok: false, status: 404, reason: 'File not found' });
      } else {
        resolve({ ok: true, status: 200 });
      }
    });
  });
}

// Check all links
async function checkAllLinks(allLinks) {
  const results = [];
  let checkedCount = 0;
  const totalCount = allLinks.size;
  
  // Process links in batches to avoid overwhelming servers
  const BATCH_SIZE = 20; // Process 20 links concurrently for faster checking
  const entries = Array.from(allLinks.entries());
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, Math.min(i + BATCH_SIZE, entries.length));
    
    // Process batch in parallel
    const batchPromises = batch.map(async ([url, locations]) => {
      const currentIndex = ++checkedCount;
      process.stdout.write(`Checking ${currentIndex}/${totalCount}: ${url.substring(0, 80)}...\r`);
      
      let result;
      if (url.startsWith('file://')) {
        result = await checkFileLink(url);
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        result = await checkHttpLink(url);
      } else {
        result = { ok: false, status: 0, reason: 'Invalid URL format' };
      }
      
      return {
        url,
        locations,
        ...result
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < entries.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log('\n'); // Clear the progress line
  return results;
}

// Print results
function printResults(results) {
  // Separate broken and working links
  const brokenLinks = results.filter(r => !r.ok);
  const workingLinks = results.filter(r => r.ok);
  
  // Print summary
  console.log('='.repeat(80));
  console.log('LINK CHECK SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total links checked: ${results.length}`);
  console.log(`${colors.green}✓ Working links: ${workingLinks.length}${colors.reset}`);
  console.log(`${colors.red}✗ Broken links: ${brokenLinks.length}${colors.reset}`);
  console.log('='.repeat(80));
  
  // Print broken links details
  if (brokenLinks.length > 0) {
    console.log('\n❌ BROKEN LINKS FOUND:\n');
    for (const link of brokenLinks) {
      console.log(`${colors.red}✗ ${link.url}${colors.reset}`);
      console.log(`  Reason: ${link.reason}`);
      console.log('  Found in:');
      for (const loc of link.locations) {
        console.log(`    - ${loc.file}:${loc.line}`);
      }
      console.log();
    }
    
    // Create GitHub annotations if running in CI
    if (process.env.GITHUB_ACTIONS) {
      for (const link of brokenLinks) {
        for (const loc of link.locations) {
          console.log(`::error file=${loc.file},line=${loc.line}::Broken link: ${link.url} (${link.reason})`);
        }
      }
    }
    
    return false;
  } else {
    console.log(`\n${colors.green}✓ All links are valid!${colors.reset}\n`);
    return true;
  }
}

// Main execution
async function main() {
  console.log('🔍 Starting link check for all README files...\n');
  
  const readmeFiles = findReadmeFiles();
  console.log(`Found ${readmeFiles.length} README files to check\n`);
  
  if (readmeFiles.length === 0) {
    console.log('No README files found to check');
    process.exit(0);
  }
  
  const allLinks = extractLinks(readmeFiles);
  console.log(`Found ${allLinks.size} unique links to check\n`);
  
  if (allLinks.size === 0) {
    console.log('No links found to check');
    process.exit(0);
  }
  
  const results = await checkAllLinks(allLinks);
  const success = printResults(results);
  
  process.exit(success ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = { findReadmeFiles, extractLinks, checkHttpLink, checkFileLink, checkAllLinks };