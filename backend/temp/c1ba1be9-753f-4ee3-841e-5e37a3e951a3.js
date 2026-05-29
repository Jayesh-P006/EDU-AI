function searchRange(nums, target) {
    function binarySearch(findFirst) {
        let left = 0, right = nums.length - 1, result = -1;
        while (left <= right) {
            let mid = Math.floor((left + right) / 2);
            if (nums[mid] === target) {
                result = mid;
                if (findFirst) {
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            } else if (nums[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return result;
    }
    return [binarySearch(true), binarySearch(false)];
}

try {
    const result = searchRange([], 0);
    console.log(JSON.stringify(result));
} catch (error) {
    console.error('ERROR: ' + error.message);
    process.exit(1);
}
