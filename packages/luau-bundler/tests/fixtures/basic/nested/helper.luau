local sub = require("nested/sub")

return {
	double = function(value)
		return value * 2 + sub.base
	end,
}
