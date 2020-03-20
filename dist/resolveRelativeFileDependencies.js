"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = require("./path");
function transformVersionString(version, appRootPath) {
    if (version.startsWith("file:") && version[5] !== "/") {
        return "file:" + path_1.resolve(appRootPath, version.slice(5));
    }
    else {
        return version;
    }
}
function resolveRelativeFileDependencies(appRootPath, resolutions) {
    var result = {};
    for (var _i = 0, _a = Object.keys(resolutions); _i < _a.length; _i++) {
        var packageName = _a[_i];
        result[packageName] = transformVersionString(resolutions[packageName], appRootPath);
    }
    return result;
}
exports.resolveRelativeFileDependencies = resolveRelativeFileDependencies;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZVJlbGF0aXZlRmlsZURlcGVuZGVuY2llcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9yZXNvbHZlUmVsYXRpdmVGaWxlRGVwZW5kZW5jaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsK0JBQWdDO0FBRWhDLFNBQVMsc0JBQXNCLENBQUMsT0FBZSxFQUFFLFdBQW1CO0lBQ2xFLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQ3JELE9BQU8sT0FBTyxHQUFHLGNBQU8sQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0tBQ3hEO1NBQU07UUFDTCxPQUFPLE9BQU8sQ0FBQTtLQUNmO0FBQ0gsQ0FBQztBQUVELFNBQWdCLCtCQUErQixDQUM3QyxXQUFtQixFQUNuQixXQUE4QztJQUU5QyxJQUFNLE1BQU0sR0FBRyxFQUF1QyxDQUFBO0lBQ3RELEtBQTBCLFVBQXdCLEVBQXhCLEtBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBeEIsY0FBd0IsRUFBeEIsSUFBd0IsRUFBRTtRQUEvQyxJQUFNLFdBQVcsU0FBQTtRQUNwQixNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsc0JBQXNCLENBQzFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsRUFDeEIsV0FBVyxDQUNaLENBQUE7S0FDRjtJQUNELE9BQU8sTUFBTSxDQUFBO0FBQ2YsQ0FBQztBQVpELDBFQVlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCIuL3BhdGhcIlxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1WZXJzaW9uU3RyaW5nKHZlcnNpb246IHN0cmluZywgYXBwUm9vdFBhdGg6IHN0cmluZykge1xuICBpZiAodmVyc2lvbi5zdGFydHNXaXRoKFwiZmlsZTpcIikgJiYgdmVyc2lvbls1XSAhPT0gXCIvXCIpIHtcbiAgICByZXR1cm4gXCJmaWxlOlwiICsgcmVzb2x2ZShhcHBSb290UGF0aCwgdmVyc2lvbi5zbGljZSg1KSlcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdmVyc2lvblxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlUmVsYXRpdmVGaWxlRGVwZW5kZW5jaWVzKFxuICBhcHBSb290UGF0aDogc3RyaW5nLFxuICByZXNvbHV0aW9uczogeyBbcGFja2FnZU5hbWU6IHN0cmluZ106IHN0cmluZyB9LFxuKSB7XG4gIGNvbnN0IHJlc3VsdCA9IHt9IGFzIHsgW3BhY2thZ2VOYW1lOiBzdHJpbmddOiBzdHJpbmcgfVxuICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKHJlc29sdXRpb25zKSkge1xuICAgIHJlc3VsdFtwYWNrYWdlTmFtZV0gPSB0cmFuc2Zvcm1WZXJzaW9uU3RyaW5nKFxuICAgICAgcmVzb2x1dGlvbnNbcGFja2FnZU5hbWVdLFxuICAgICAgYXBwUm9vdFBhdGgsXG4gICAgKVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cbiJdfQ==