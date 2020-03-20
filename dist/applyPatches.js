"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = __importDefault(require("chalk"));
var patchFs_1 = require("./patchFs");
var apply_1 = require("./patch/apply");
var fs_extra_1 = require("fs-extra");
var path_1 = require("./path");
var path_2 = require("path");
var PackageDetails_1 = require("./PackageDetails");
var reverse_1 = require("./patch/reverse");
var is_ci_1 = __importDefault(require("is-ci"));
var semver_1 = __importDefault(require("semver"));
var read_1 = require("./patch/read");
var packageIsDevDependency_1 = require("./packageIsDevDependency");
// don't want to exit(1) on postinsall locally.
// see https://github.com/ds300/patch-package/issues/86
var shouldExitPostinstallWithError = is_ci_1.default || process.env.NODE_ENV === "test";
var exit = function () { return process.exit(shouldExitPostinstallWithError ? 1 : 0); };
function findPatchFiles(patchesDirectory) {
    if (!fs_extra_1.existsSync(patchesDirectory)) {
        return [];
    }
    return patchFs_1.getPatchFiles(patchesDirectory);
}
function getInstalledPackageVersion(_a) {
    var appPath = _a.appPath, path = _a.path, pathSpecifier = _a.pathSpecifier, isDevOnly = _a.isDevOnly, patchFilename = _a.patchFilename;
    var packageDir = path_1.join(appPath, path);
    if (!fs_extra_1.existsSync(packageDir)) {
        if (process.env.NODE_ENV === "production" && isDevOnly) {
            return null;
        }
        console.error(chalk_1.default.red("Error:") + " Patch file found for package " + path_2.posix.basename(pathSpecifier) + (" which is not present at " + path_1.relative(".", packageDir)));
        if (!isDevOnly && process.env.NODE_ENV === "production") {
            console.error("\n  If this package is a dev dependency, rename the patch file to\n  \n    " + chalk_1.default.bold(patchFilename.replace(".patch", ".dev.patch")) + "\n");
        }
        throw new Error("applyPatches");
    }
    var version = require(path_1.join(packageDir, "package.json")).version;
    // normalize version for `npm ci`
    var result = semver_1.default.valid(version);
    if (result === null) {
        console.error(chalk_1.default.red("Error:") + " Version string '" + version + "' cannot be parsed from " + path_1.join(packageDir, "package.json"));
        throw new Error("applyPatches");
    }
    return result;
}
function applyPatchesForApp(_a) {
    var appPath = _a.appPath, reverse = _a.reverse, ignoreErrors = _a.ignoreErrors, patchDir = _a.patchDir;
    var patchesDirectory = path_1.join(appPath, patchDir);
    var files = findPatchFiles(patchesDirectory);
    if (files.length === 0) {
        console.error(chalk_1.default.red("No patch files found"));
        return;
    }
    var hasFailed = false;
    files.forEach(function (filename, idx) {
        try {
            var packageDetails = PackageDetails_1.getPackageDetailsFromPatchFilename(filename);
            if (!packageDetails) {
                console.warn("Unrecognized patch file in patches directory " + filename);
                return;
            }
            var name = packageDetails.name, version = packageDetails.version, path = packageDetails.path, pathSpecifier = packageDetails.pathSpecifier, isDevOnly = packageDetails.isDevOnly, patchFilename = packageDetails.patchFilename;
            var installedPackageVersion = getInstalledPackageVersion({
                appPath: appPath,
                path: path,
                pathSpecifier: pathSpecifier,
                isDevOnly: isDevOnly ||
                    // check for direct-dependents in prod
                    (process.env.NODE_ENV === "production" &&
                        packageIsDevDependency_1.packageIsDevDependency({ appPath: appPath, packageDetails: packageDetails })),
                patchFilename: patchFilename,
            });
            if (!installedPackageVersion) {
                // it's ok we're in production mode and this is a dev only package
                console.log("Skipping dev-only " + chalk_1.default.bold(pathSpecifier) + "@" + version + " " + chalk_1.default.blue("✔"));
                return;
            }
            if (applyPatch({
                patchFilePath: path_1.resolve(patchesDirectory, filename),
                reverse: reverse,
                packageDetails: packageDetails,
                patchDir: patchDir,
            })) {
                // yay patch was applied successfully
                // print warning if version mismatch
                if (installedPackageVersion !== version) {
                    printVersionMismatchWarning({
                        packageName: name,
                        actualVersion: installedPackageVersion,
                        originalVersion: version,
                        pathSpecifier: pathSpecifier,
                        path: path,
                    });
                }
                else {
                    console.log(chalk_1.default.bold(pathSpecifier) + "@" + version + " " + chalk_1.default.green("✔"));
                }
            }
            else {
                // completely failed to apply patch
                // TODO: propagate useful error messages from patch application
                if (installedPackageVersion === version) {
                    printBrokenPatchFileError({
                        packageName: name,
                        patchFileName: filename,
                        pathSpecifier: pathSpecifier,
                        path: path,
                    });
                }
                else {
                    printPatchApplictionFailureError({
                        packageName: name,
                        actualVersion: installedPackageVersion,
                        originalVersion: version,
                        patchFileName: filename,
                        path: path,
                        pathSpecifier: pathSpecifier,
                    });
                }
                throw new Error("applyPatches");
            }
        }
        catch (err) {
            if (err.message !== "applyPatches") {
                throw err;
            }
            if (!ignoreErrors) {
                exit();
            }
            hasFailed = true;
            if (idx < files.length - 1) {
                console.warn(chalk_1.default.yellow("Warning:") + " Option " + chalk_1.default.bold("--ignore-errors") + " was set, moving on to next patch.");
            }
        }
    });
    if (hasFailed) {
        exit();
    }
}
exports.applyPatchesForApp = applyPatchesForApp;
function applyPatch(_a) {
    var patchFilePath = _a.patchFilePath, reverse = _a.reverse, packageDetails = _a.packageDetails, patchDir = _a.patchDir;
    var patch = read_1.readPatch({ patchFilePath: patchFilePath, packageDetails: packageDetails, patchDir: patchDir });
    try {
        apply_1.executeEffects(reverse ? reverse_1.reversePatch(patch) : patch, { dryRun: false });
    }
    catch (e) {
        try {
            apply_1.executeEffects(reverse ? patch : reverse_1.reversePatch(patch), { dryRun: true });
        }
        catch (e) {
            return false;
        }
    }
    return true;
}
exports.applyPatch = applyPatch;
function printVersionMismatchWarning(_a) {
    var packageName = _a.packageName, actualVersion = _a.actualVersion, originalVersion = _a.originalVersion, pathSpecifier = _a.pathSpecifier, path = _a.path;
    console.warn("\n" + chalk_1.default.red("Warning:") + " patch-package detected a patch file version mismatch\n\n  Don't worry! This is probably fine. The patch was still applied\n  successfully. Here's the deets:\n\n  Patch file created for\n\n    " + packageName + "@" + chalk_1.default.bold(originalVersion) + "\n\n  applied to\n\n    " + packageName + "@" + chalk_1.default.bold(actualVersion) + "\n  \n  At path\n  \n    " + path + "\n\n  This warning is just to give you a heads-up. There is a small chance of\n  breakage even though the patch was applied successfully. Make sure the package\n  still behaves like you expect (you wrote tests, right?) and then run\n\n    " + chalk_1.default.bold("patch-package " + pathSpecifier) + "\n\n  to update the version in the patch file name and make this warning go away.\n");
}
function printBrokenPatchFileError(_a) {
    var packageName = _a.packageName, patchFileName = _a.patchFileName, path = _a.path, pathSpecifier = _a.pathSpecifier;
    console.error("\n" + chalk_1.default.red.bold("**ERROR**") + " " + chalk_1.default.red("Failed to apply patch for package " + chalk_1.default.bold(packageName) + " at path") + "\n  \n    " + path + "\n\n  This error was caused because patch-package cannot apply the following patch file:\n\n    patches/" + patchFileName + "\n\n  Try removing node_modules and trying again. If that doesn't work, maybe there was\n  an accidental change made to the patch file? Try recreating it by manually\n  editing the appropriate files and running:\n  \n    patch-package " + pathSpecifier + "\n  \n  If that doesn't work, then it's a bug in patch-package, so please submit a bug\n  report. Thanks!\n\n    https://github.com/ds300/patch-package/issues\n    \n");
}
function printPatchApplictionFailureError(_a) {
    var packageName = _a.packageName, actualVersion = _a.actualVersion, originalVersion = _a.originalVersion, patchFileName = _a.patchFileName, path = _a.path, pathSpecifier = _a.pathSpecifier;
    console.error("\n" + chalk_1.default.red.bold("**ERROR**") + " " + chalk_1.default.red("Failed to apply patch for package " + chalk_1.default.bold(packageName) + " at path") + "\n  \n    " + path + "\n\n  This error was caused because " + chalk_1.default.bold(packageName) + " has changed since you\n  made the patch file for it. This introduced conflicts with your patch,\n  just like a merge conflict in Git when separate incompatible changes are\n  made to the same piece of code.\n\n  Maybe this means your patch file is no longer necessary, in which case\n  hooray! Just delete it!\n\n  Otherwise, you need to generate a new patch file.\n\n  To generate a new one, just repeat the steps you made to generate the first\n  one.\n\n  i.e. manually make the appropriate file changes, then run \n\n    patch-package " + pathSpecifier + "\n\n  Info:\n    Patch file: patches/" + patchFileName + "\n    Patch was made for version: " + chalk_1.default.green.bold(originalVersion) + "\n    Installed version: " + chalk_1.default.red.bold(actualVersion) + "\n");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHlQYXRjaGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2FwcGx5UGF0Y2hlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdEQUF5QjtBQUN6QixxQ0FBeUM7QUFDekMsdUNBQThDO0FBQzlDLHFDQUFxQztBQUNyQywrQkFBZ0Q7QUFDaEQsNkJBQTRCO0FBQzVCLG1EQUd5QjtBQUN6QiwyQ0FBOEM7QUFDOUMsZ0RBQXdCO0FBQ3hCLGtEQUEyQjtBQUMzQixxQ0FBd0M7QUFDeEMsbUVBQWlFO0FBRWpFLCtDQUErQztBQUMvQyx1REFBdUQ7QUFDdkQsSUFBTSw4QkFBOEIsR0FBRyxlQUFJLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssTUFBTSxDQUFBO0FBRTlFLElBQU0sSUFBSSxHQUFHLGNBQU0sT0FBQSxPQUFPLENBQUMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFwRCxDQUFvRCxDQUFBO0FBRXZFLFNBQVMsY0FBYyxDQUFDLGdCQUF3QjtJQUM5QyxJQUFJLENBQUMscUJBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO1FBQ2pDLE9BQU8sRUFBRSxDQUFBO0tBQ1Y7SUFFRCxPQUFPLHVCQUFhLENBQUMsZ0JBQWdCLENBQWEsQ0FBQTtBQUNwRCxDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxFQVluQztRQVhDLG9CQUFPLEVBQ1AsY0FBSSxFQUNKLGdDQUFhLEVBQ2Isd0JBQVMsRUFDVCxnQ0FBYTtJQVFiLElBQU0sVUFBVSxHQUFHLFdBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDdEMsSUFBSSxDQUFDLHFCQUFVLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDM0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLElBQUksU0FBUyxFQUFFO1lBQ3RELE9BQU8sSUFBSSxDQUFB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QUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxpQ0FDMUMsZUFBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQ3JELENBQUMsQ0FBQTtBQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCJcbmltcG9ydCB7IGdldFBhdGNoRmlsZXMgfSBmcm9tIFwiLi9wYXRjaEZzXCJcbmltcG9ydCB7IGV4ZWN1dGVFZmZlY3RzIH0gZnJvbSBcIi4vcGF0Y2gvYXBwbHlcIlxuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgeyBqb2luLCByZXNvbHZlLCByZWxhdGl2ZSB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IHsgcG9zaXggfSBmcm9tIFwicGF0aFwiXG5pbXBvcnQge1xuICBnZXRQYWNrYWdlRGV0YWlsc0Zyb21QYXRjaEZpbGVuYW1lLFxuICBQYWNrYWdlRGV0YWlscyxcbn0gZnJvbSBcIi4vUGFja2FnZURldGFpbHNcIlxuaW1wb3J0IHsgcmV2ZXJzZVBhdGNoIH0gZnJvbSBcIi4vcGF0Y2gvcmV2ZXJzZVwiXG5pbXBvcnQgaXNDaSBmcm9tIFwiaXMtY2lcIlxuaW1wb3J0IHNlbXZlciBmcm9tIFwic2VtdmVyXCJcbmltcG9ydCB7IHJlYWRQYXRjaCB9IGZyb20gXCIuL3BhdGNoL3JlYWRcIlxuaW1wb3J0IHsgcGFja2FnZUlzRGV2RGVwZW5kZW5jeSB9IGZyb20gXCIuL3BhY2thZ2VJc0RldkRlcGVuZGVuY3lcIlxuXG4vLyBkb24ndCB3YW50IHRvIGV4aXQoMSkgb24gcG9zdGluc2FsbCBsb2NhbGx5LlxuLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9kczMwMC9wYXRjaC1wYWNrYWdlL2lzc3Vlcy84NlxuY29uc3Qgc2hvdWxkRXhpdFBvc3RpbnN0YWxsV2l0aEVycm9yID0gaXNDaSB8fCBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJ0ZXN0XCJcblxuY29uc3QgZXhpdCA9ICgpID0+IHByb2Nlc3MuZXhpdChzaG91bGRFeGl0UG9zdGluc3RhbGxXaXRoRXJyb3IgPyAxIDogMClcblxuZnVuY3Rpb24gZmluZFBhdGNoRmlsZXMocGF0Y2hlc0RpcmVjdG9yeTogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoIWV4aXN0c1N5bmMocGF0Y2hlc0RpcmVjdG9yeSkpIHtcbiAgICByZXR1cm4gW11cbiAgfVxuXG4gIHJldHVybiBnZXRQYXRjaEZpbGVzKHBhdGNoZXNEaXJlY3RvcnkpIGFzIHN0cmluZ1tdXG59XG5cbmZ1bmN0aW9uIGdldEluc3RhbGxlZFBhY2thZ2VWZXJzaW9uKHtcbiAgYXBwUGF0aCxcbiAgcGF0aCxcbiAgcGF0aFNwZWNpZmllcixcbiAgaXNEZXZPbmx5LFxuICBwYXRjaEZpbGVuYW1lLFxufToge1xuICBhcHBQYXRoOiBzdHJpbmdcbiAgcGF0aDogc3RyaW5nXG4gIHBhdGhTcGVjaWZpZXI6IHN0cmluZ1xuICBpc0Rldk9ubHk6IGJvb2xlYW5cbiAgcGF0Y2hGaWxlbmFtZTogc3RyaW5nXG59KTogbnVsbCB8IHN0cmluZyB7XG4gIGNvbnN0IHBhY2thZ2VEaXIgPSBqb2luKGFwcFBhdGgsIHBhdGgpXG4gIGlmICghZXhpc3RzU3luYyhwYWNrYWdlRGlyKSkge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgaXNEZXZPbmx5KSB7XG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYCR7Y2hhbGsucmVkKFwiRXJyb3I6XCIpfSBQYXRjaCBmaWxlIGZvdW5kIGZvciBwYWNrYWdlICR7cG9zaXguYmFzZW5hbWUoXG4gICAgICAgIHBhdGhTcGVjaWZpZXIsXG4gICAgICApfWAgKyBgIHdoaWNoIGlzIG5vdCBwcmVzZW50IGF0ICR7cmVsYXRpdmUoXCIuXCIsIHBhY2thZ2VEaXIpfWAsXG4gICAgKVxuXG4gICAgaWYgKCFpc0Rldk9ubHkgJiYgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICBgXG4gIElmIHRoaXMgcGFja2FnZSBpcyBhIGRldiBkZXBlbmRlbmN5LCByZW5hbWUgdGhlIHBhdGNoIGZpbGUgdG9cbiAgXG4gICAgJHtjaGFsay5ib2xkKHBhdGNoRmlsZW5hbWUucmVwbGFjZShcIi5wYXRjaFwiLCBcIi5kZXYucGF0Y2hcIikpfVxuYCxcbiAgICAgIClcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcHBseVBhdGNoZXNcIilcbiAgfVxuXG4gIGNvbnN0IHsgdmVyc2lvbiB9ID0gcmVxdWlyZShqb2luKHBhY2thZ2VEaXIsIFwicGFja2FnZS5qc29uXCIpKVxuICAvLyBub3JtYWxpemUgdmVyc2lvbiBmb3IgYG5wbSBjaWBcbiAgY29uc3QgcmVzdWx0ID0gc2VtdmVyLnZhbGlkKHZlcnNpb24pXG4gIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICBjb25zb2xlLmVycm9yKFxuICAgICAgYCR7Y2hhbGsucmVkKFxuICAgICAgICBcIkVycm9yOlwiLFxuICAgICAgKX0gVmVyc2lvbiBzdHJpbmcgJyR7dmVyc2lvbn0nIGNhbm5vdCBiZSBwYXJzZWQgZnJvbSAke2pvaW4oXG4gICAgICAgIHBhY2thZ2VEaXIsXG4gICAgICAgIFwicGFja2FnZS5qc29uXCIsXG4gICAgICApfWAsXG4gICAgKVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiYXBwbHlQYXRjaGVzXCIpXG4gIH1cblxuICByZXR1cm4gcmVzdWx0IGFzIHN0cmluZ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQYXRjaGVzRm9yQXBwKHtcbiAgYXBwUGF0aCxcbiAgcmV2ZXJzZSxcbiAgaWdub3JlRXJyb3JzLFxuICBwYXRjaERpcixcbn06IHtcbiAgYXBwUGF0aDogc3RyaW5nXG4gIHJldmVyc2U6IGJvb2xlYW5cbiAgaWdub3JlRXJyb3JzOiBib29sZWFuXG4gIHBhdGNoRGlyOiBzdHJpbmdcbn0pOiB2b2lkIHtcbiAgY29uc3QgcGF0Y2hlc0RpcmVjdG9yeSA9IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIpXG4gIGNvbnN0IGZpbGVzID0gZmluZFBhdGNoRmlsZXMocGF0Y2hlc0RpcmVjdG9yeSlcblxuICBpZiAoZmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgY29uc29sZS5lcnJvcihjaGFsay5yZWQoXCJObyBwYXRjaCBmaWxlcyBmb3VuZFwiKSlcbiAgICByZXR1cm5cbiAgfVxuXG4gIGxldCBoYXNGYWlsZWQgPSBmYWxzZVxuICBmaWxlcy5mb3JFYWNoKChmaWxlbmFtZSwgaWR4KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhY2thZ2VEZXRhaWxzID0gZ2V0UGFja2FnZURldGFpbHNGcm9tUGF0Y2hGaWxlbmFtZShmaWxlbmFtZSlcblxuICAgICAgaWYgKCFwYWNrYWdlRGV0YWlscykge1xuICAgICAgICBjb25zb2xlLndhcm4oYFVucmVjb2duaXplZCBwYXRjaCBmaWxlIGluIHBhdGNoZXMgZGlyZWN0b3J5ICR7ZmlsZW5hbWV9YClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgICAgcGF0aCxcbiAgICAgICAgcGF0aFNwZWNpZmllcixcbiAgICAgICAgaXNEZXZPbmx5LFxuICAgICAgICBwYXRjaEZpbGVuYW1lLFxuICAgICAgfSA9IHBhY2thZ2VEZXRhaWxzXG5cbiAgICAgIGNvbnN0IGluc3RhbGxlZFBhY2thZ2VWZXJzaW9uID0gZ2V0SW5zdGFsbGVkUGFja2FnZVZlcnNpb24oe1xuICAgICAgICBhcHBQYXRoLFxuICAgICAgICBwYXRoLFxuICAgICAgICBwYXRoU3BlY2lmaWVyLFxuICAgICAgICBpc0Rldk9ubHk6XG4gICAgICAgICAgaXNEZXZPbmx5IHx8XG4gICAgICAgICAgLy8gY2hlY2sgZm9yIGRpcmVjdC1kZXBlbmRlbnRzIGluIHByb2RcbiAgICAgICAgICAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwicHJvZHVjdGlvblwiICYmXG4gICAgICAgICAgICBwYWNrYWdlSXNEZXZEZXBlbmRlbmN5KHsgYXBwUGF0aCwgcGFja2FnZURldGFpbHMgfSkpLFxuICAgICAgICBwYXRjaEZpbGVuYW1lLFxuICAgICAgfSlcbiAgICAgIGlmICghaW5zdGFsbGVkUGFja2FnZVZlcnNpb24pIHtcbiAgICAgICAgLy8gaXQncyBvayB3ZSdyZSBpbiBwcm9kdWN0aW9uIG1vZGUgYW5kIHRoaXMgaXMgYSBkZXYgb25seSBwYWNrYWdlXG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBTa2lwcGluZyBkZXYtb25seSAke2NoYWxrLmJvbGQoXG4gICAgICAgICAgICBwYXRoU3BlY2lmaWVyLFxuICAgICAgICAgICl9QCR7dmVyc2lvbn0gJHtjaGFsay5ibHVlKFwi4pyUXCIpfWAsXG4gICAgICAgIClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGlmIChcbiAgICAgICAgYXBwbHlQYXRjaCh7XG4gICAgICAgICAgcGF0Y2hGaWxlUGF0aDogcmVzb2x2ZShwYXRjaGVzRGlyZWN0b3J5LCBmaWxlbmFtZSkgYXMgc3RyaW5nLFxuICAgICAgICAgIHJldmVyc2UsXG4gICAgICAgICAgcGFja2FnZURldGFpbHMsXG4gICAgICAgICAgcGF0Y2hEaXIsXG4gICAgICAgIH0pXG4gICAgICApIHtcbiAgICAgICAgLy8geWF5IHBhdGNoIHdhcyBhcHBsaWVkIHN1Y2Nlc3NmdWxseVxuICAgICAgICAvLyBwcmludCB3YXJuaW5nIGlmIHZlcnNpb24gbWlzbWF0Y2hcbiAgICAgICAgaWYgKGluc3RhbGxlZFBhY2thZ2VWZXJzaW9uICE9PSB2ZXJzaW9uKSB7XG4gICAgICAgICAgcHJpbnRWZXJzaW9uTWlzbWF0Y2hXYXJuaW5nKHtcbiAgICAgICAgICAgIHBhY2thZ2VOYW1lOiBuYW1lLFxuICAgICAgICAgICAgYWN0dWFsVmVyc2lvbjogaW5zdGFsbGVkUGFja2FnZVZlcnNpb24sXG4gICAgICAgICAgICBvcmlnaW5hbFZlcnNpb246IHZlcnNpb24sXG4gICAgICAgICAgICBwYXRoU3BlY2lmaWVyLFxuICAgICAgICAgICAgcGF0aCxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgYCR7Y2hhbGsuYm9sZChwYXRoU3BlY2lmaWVyKX1AJHt2ZXJzaW9ufSAke2NoYWxrLmdyZWVuKFwi4pyUXCIpfWAsXG4gICAgICAgICAgKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBjb21wbGV0ZWx5IGZhaWxlZCB0byBhcHBseSBwYXRjaFxuICAgICAgICAvLyBUT0RPOiBwcm9wYWdhdGUgdXNlZnVsIGVycm9yIG1lc3NhZ2VzIGZyb20gcGF0Y2ggYXBwbGljYXRpb25cbiAgICAgICAgaWYgKGluc3RhbGxlZFBhY2thZ2VWZXJzaW9uID09PSB2ZXJzaW9uKSB7XG4gICAgICAgICAgcHJpbnRCcm9rZW5QYXRjaEZpbGVFcnJvcih7XG4gICAgICAgICAgICBwYWNrYWdlTmFtZTogbmFtZSxcbiAgICAgICAgICAgIHBhdGNoRmlsZU5hbWU6IGZpbGVuYW1lLFxuICAgICAgICAgICAgcGF0aFNwZWNpZmllcixcbiAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgfSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcmludFBhdGNoQXBwbGljdGlvbkZhaWx1cmVFcnJvcih7XG4gICAgICAgICAgICBwYWNrYWdlTmFtZTogbmFtZSxcbiAgICAgICAgICAgIGFjdHVhbFZlcnNpb246IGluc3RhbGxlZFBhY2thZ2VWZXJzaW9uLFxuICAgICAgICAgICAgb3JpZ2luYWxWZXJzaW9uOiB2ZXJzaW9uLFxuICAgICAgICAgICAgcGF0Y2hGaWxlTmFtZTogZmlsZW5hbWUsXG4gICAgICAgICAgICBwYXRoLFxuICAgICAgICAgICAgcGF0aFNwZWNpZmllcixcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYXBwbHlQYXRjaGVzXCIpXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyLm1lc3NhZ2UgIT09IFwiYXBwbHlQYXRjaGVzXCIpIHtcbiAgICAgICAgdGhyb3cgZXJyXG4gICAgICB9XG4gICAgICBpZiAoIWlnbm9yZUVycm9ycykge1xuICAgICAgICBleGl0KClcbiAgICAgIH1cbiAgICAgIGhhc0ZhaWxlZCA9IHRydWVcbiAgICAgIGlmIChpZHggPCBmaWxlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBgJHtjaGFsay55ZWxsb3coXCJXYXJuaW5nOlwiKX0gT3B0aW9uICR7Y2hhbGsuYm9sZChcbiAgICAgICAgICAgIFwiLS1pZ25vcmUtZXJyb3JzXCIsXG4gICAgICAgICAgKX0gd2FzIHNldCwgbW92aW5nIG9uIHRvIG5leHQgcGF0Y2guYCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cbiAgfSlcbiAgaWYgKGhhc0ZhaWxlZCkge1xuICAgIGV4aXQoKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBhdGNoKHtcbiAgcGF0Y2hGaWxlUGF0aCxcbiAgcmV2ZXJzZSxcbiAgcGFja2FnZURldGFpbHMsXG4gIHBhdGNoRGlyLFxufToge1xuICBwYXRjaEZpbGVQYXRoOiBzdHJpbmdcbiAgcmV2ZXJzZTogYm9vbGVhblxuICBwYWNrYWdlRGV0YWlsczogUGFja2FnZURldGFpbHNcbiAgcGF0Y2hEaXI6IHN0cmluZ1xufSk6IGJvb2xlYW4ge1xuICBjb25zdCBwYXRjaCA9IHJlYWRQYXRjaCh7IHBhdGNoRmlsZVBhdGgsIHBhY2thZ2VEZXRhaWxzLCBwYXRjaERpciB9KVxuICB0cnkge1xuICAgIGV4ZWN1dGVFZmZlY3RzKHJldmVyc2UgPyByZXZlcnNlUGF0Y2gocGF0Y2gpIDogcGF0Y2gsIHsgZHJ5UnVuOiBmYWxzZSB9KVxuICB9IGNhdGNoIChlKSB7XG4gICAgdHJ5IHtcbiAgICAgIGV4ZWN1dGVFZmZlY3RzKHJldmVyc2UgPyBwYXRjaCA6IHJldmVyc2VQYXRjaChwYXRjaCksIHsgZHJ5UnVuOiB0cnVlIH0pXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gcHJpbnRWZXJzaW9uTWlzbWF0Y2hXYXJuaW5nKHtcbiAgcGFja2FnZU5hbWUsXG4gIGFjdHVhbFZlcnNpb24sXG4gIG9yaWdpbmFsVmVyc2lvbixcbiAgcGF0aFNwZWNpZmllcixcbiAgcGF0aCxcbn06IHtcbiAgcGFja2FnZU5hbWU6IHN0cmluZ1xuICBhY3R1YWxWZXJzaW9uOiBzdHJpbmdcbiAgb3JpZ2luYWxWZXJzaW9uOiBzdHJpbmdcbiAgcGF0aFNwZWNpZmllcjogc3RyaW5nXG4gIHBhdGg6IHN0cmluZ1xufSkge1xuICBjb25zb2xlLndhcm4oYFxuJHtjaGFsay5yZWQoXCJXYXJuaW5nOlwiKX0gcGF0Y2gtcGFja2FnZSBkZXRlY3RlZCBhIHBhdGNoIGZpbGUgdmVyc2lvbiBtaXNtYXRjaFxuXG4gIERvbid0IHdvcnJ5ISBUaGlzIGlzIHByb2JhYmx5IGZpbmUuIFRoZSBwYXRjaCB3YXMgc3RpbGwgYXBwbGllZFxuICBzdWNjZXNzZnVsbHkuIEhlcmUncyB0aGUgZGVldHM6XG5cbiAgUGF0Y2ggZmlsZSBjcmVhdGVkIGZvclxuXG4gICAgJHtwYWNrYWdlTmFtZX1AJHtjaGFsay5ib2xkKG9yaWdpbmFsVmVyc2lvbil9XG5cbiAgYXBwbGllZCB0b1xuXG4gICAgJHtwYWNrYWdlTmFtZX1AJHtjaGFsay5ib2xkKGFjdHVhbFZlcnNpb24pfVxuICBcbiAgQXQgcGF0aFxuICBcbiAgICAke3BhdGh9XG5cbiAgVGhpcyB3YXJuaW5nIGlzIGp1c3QgdG8gZ2l2ZSB5b3UgYSBoZWFkcy11cC4gVGhlcmUgaXMgYSBzbWFsbCBjaGFuY2Ugb2ZcbiAgYnJlYWthZ2UgZXZlbiB0aG91Z2ggdGhlIHBhdGNoIHdhcyBhcHBsaWVkIHN1Y2Nlc3NmdWxseS4gTWFrZSBzdXJlIHRoZSBwYWNrYWdlXG4gIHN0aWxsIGJlaGF2ZXMgbGlrZSB5b3UgZXhwZWN0ICh5b3Ugd3JvdGUgdGVzdHMsIHJpZ2h0PykgYW5kIHRoZW4gcnVuXG5cbiAgICAke2NoYWxrLmJvbGQoYHBhdGNoLXBhY2thZ2UgJHtwYXRoU3BlY2lmaWVyfWApfVxuXG4gIHRvIHVwZGF0ZSB0aGUgdmVyc2lvbiBpbiB0aGUgcGF0Y2ggZmlsZSBuYW1lIGFuZCBtYWtlIHRoaXMgd2FybmluZyBnbyBhd2F5LlxuYClcbn1cblxuZnVuY3Rpb24gcHJpbnRCcm9rZW5QYXRjaEZpbGVFcnJvcih7XG4gIHBhY2thZ2VOYW1lLFxuICBwYXRjaEZpbGVOYW1lLFxuICBwYXRoLFxuICBwYXRoU3BlY2lmaWVyLFxufToge1xuICBwYWNrYWdlTmFtZTogc3RyaW5nXG4gIHBhdGNoRmlsZU5hbWU6IHN0cmluZ1xuICBwYXRoOiBzdHJpbmdcbiAgcGF0aFNwZWNpZmllcjogc3RyaW5nXG59KSB7XG4gIGNvbnNvbGUuZXJyb3IoYFxuJHtjaGFsay5yZWQuYm9sZChcIioqRVJST1IqKlwiKX0gJHtjaGFsay5yZWQoXG4gICAgYEZhaWxlZCB0byBhcHBseSBwYXRjaCBmb3IgcGFja2FnZSAke2NoYWxrLmJvbGQocGFja2FnZU5hbWUpfSBhdCBwYXRoYCxcbiAgKX1cbiAgXG4gICAgJHtwYXRofVxuXG4gIFRoaXMgZXJyb3Igd2FzIGNhdXNlZCBiZWNhdXNlIHBhdGNoLXBhY2thZ2UgY2Fubm90IGFwcGx5IHRoZSBmb2xsb3dpbmcgcGF0Y2ggZmlsZTpcblxuICAgIHBhdGNoZXMvJHtwYXRjaEZpbGVOYW1lfVxuXG4gIFRyeSByZW1vdmluZyBub2RlX21vZHVsZXMgYW5kIHRyeWluZyBhZ2Fpbi4gSWYgdGhhdCBkb2Vzbid0IHdvcmssIG1heWJlIHRoZXJlIHdhc1xuICBhbiBhY2NpZGVudGFsIGNoYW5nZSBtYWRlIHRvIHRoZSBwYXRjaCBmaWxlPyBUcnkgcmVjcmVhdGluZyBpdCBieSBtYW51YWxseVxuICBlZGl0aW5nIHRoZSBhcHByb3ByaWF0ZSBmaWxlcyBhbmQgcnVubmluZzpcbiAgXG4gICAgcGF0Y2gtcGFja2FnZSAke3BhdGhTcGVjaWZpZXJ9XG4gIFxuICBJZiB0aGF0IGRvZXNuJ3Qgd29yaywgdGhlbiBpdCdzIGEgYnVnIGluIHBhdGNoLXBhY2thZ2UsIHNvIHBsZWFzZSBzdWJtaXQgYSBidWdcbiAgcmVwb3J0LiBUaGFua3MhXG5cbiAgICBodHRwczovL2dpdGh1Yi5jb20vZHMzMDAvcGF0Y2gtcGFja2FnZS9pc3N1ZXNcbiAgICBcbmApXG59XG5cbmZ1bmN0aW9uIHByaW50UGF0Y2hBcHBsaWN0aW9uRmFpbHVyZUVycm9yKHtcbiAgcGFja2FnZU5hbWUsXG4gIGFjdHVhbFZlcnNpb24sXG4gIG9yaWdpbmFsVmVyc2lvbixcbiAgcGF0Y2hGaWxlTmFtZSxcbiAgcGF0aCxcbiAgcGF0aFNwZWNpZmllcixcbn06IHtcbiAgcGFja2FnZU5hbWU6IHN0cmluZ1xuICBhY3R1YWxWZXJzaW9uOiBzdHJpbmdcbiAgb3JpZ2luYWxWZXJzaW9uOiBzdHJpbmdcbiAgcGF0Y2hGaWxlTmFtZTogc3RyaW5nXG4gIHBhdGg6IHN0cmluZ1xuICBwYXRoU3BlY2lmaWVyOiBzdHJpbmdcbn0pIHtcbiAgY29uc29sZS5lcnJvcihgXG4ke2NoYWxrLnJlZC5ib2xkKFwiKipFUlJPUioqXCIpfSAke2NoYWxrLnJlZChcbiAgICBgRmFpbGVkIHRvIGFwcGx5IHBhdGNoIGZvciBwYWNrYWdlICR7Y2hhbGsuYm9sZChwYWNrYWdlTmFtZSl9IGF0IHBhdGhgLFxuICApfVxuICBcbiAgICAke3BhdGh9XG5cbiAgVGhpcyBlcnJvciB3YXMgY2F1c2VkIGJlY2F1c2UgJHtjaGFsay5ib2xkKHBhY2thZ2VOYW1lKX0gaGFzIGNoYW5nZWQgc2luY2UgeW91XG4gIG1hZGUgdGhlIHBhdGNoIGZpbGUgZm9yIGl0LiBUaGlzIGludHJvZHVjZWQgY29uZmxpY3RzIHdpdGggeW91ciBwYXRjaCxcbiAganVzdCBsaWtlIGEgbWVyZ2UgY29uZmxpY3QgaW4gR2l0IHdoZW4gc2VwYXJhdGUgaW5jb21wYXRpYmxlIGNoYW5nZXMgYXJlXG4gIG1hZGUgdG8gdGhlIHNhbWUgcGllY2Ugb2YgY29kZS5cblxuICBNYXliZSB0aGlzIG1lYW5zIHlvdXIgcGF0Y2ggZmlsZSBpcyBubyBsb25nZXIgbmVjZXNzYXJ5LCBpbiB3aGljaCBjYXNlXG4gIGhvb3JheSEgSnVzdCBkZWxldGUgaXQhXG5cbiAgT3RoZXJ3aXNlLCB5b3UgbmVlZCB0byBnZW5lcmF0ZSBhIG5ldyBwYXRjaCBmaWxlLlxuXG4gIFRvIGdlbmVyYXRlIGEgbmV3IG9uZSwganVzdCByZXBlYXQgdGhlIHN0ZXBzIHlvdSBtYWRlIHRvIGdlbmVyYXRlIHRoZSBmaXJzdFxuICBvbmUuXG5cbiAgaS5lLiBtYW51YWxseSBtYWtlIHRoZSBhcHByb3ByaWF0ZSBmaWxlIGNoYW5nZXMsIHRoZW4gcnVuIFxuXG4gICAgcGF0Y2gtcGFja2FnZSAke3BhdGhTcGVjaWZpZXJ9XG5cbiAgSW5mbzpcbiAgICBQYXRjaCBmaWxlOiBwYXRjaGVzLyR7cGF0Y2hGaWxlTmFtZX1cbiAgICBQYXRjaCB3YXMgbWFkZSBmb3IgdmVyc2lvbjogJHtjaGFsay5ncmVlbi5ib2xkKG9yaWdpbmFsVmVyc2lvbil9XG4gICAgSW5zdGFsbGVkIHZlcnNpb246ICR7Y2hhbGsucmVkLmJvbGQoYWN0dWFsVmVyc2lvbil9XG5gKVxufVxuIl19