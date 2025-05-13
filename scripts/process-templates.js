import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import fs from 'fs';
import nunjucks from 'nunjucks';
import path from 'path';

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program.version('0.0.1');
program.option('-c, --child-chain-id <child-chain-id>', 'Child chain id', '15001');
program.option('-r, --root-chain-id <root-chain-id>', 'Root chain id', '5');
program.parse(process.argv);

// Joining path of directory
const directoryPath = path.join(__dirname, '..', '**/*.template');

// Function to process templates
export async function processTemplates() {
  try {
    const files = await glob(directoryPath);

    // Listing all files using forEach
    files.forEach((file) => {
      if (fs.lstatSync(file).isDirectory()) {
        return;
      }
      const childChainIdHex = parseInt(program.opts().childChainId, 10)
        .toString(16)
        .toUpperCase();

      const rootChainIdHex = parseInt(program.opts().rootChainId, 10)
        .toString(16)
        .toUpperCase();

      const data = {
        childChainId: program.opts().childChainId,
        rootChainId: program.opts().rootChainId,
        childChainIdHex:
          childChainIdHex.length % 2 !== 0 ? `0${childChainIdHex}` : childChainIdHex,
        rootChainIdHex:
          rootChainIdHex.length % 2 !== 0 ? `0${rootChainIdHex}` : rootChainIdHex,
      };

      const templateString = fs.readFileSync(file).toString();
      const resultString = nunjucks.renderString(templateString, data);
      fs.writeFileSync(file.replace('.template', ''), resultString);
    });

    console.log('All template files have been processed.');
  } catch (err) {
    console.error('Unable to scan directory:', err);
  }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processTemplates();
}
