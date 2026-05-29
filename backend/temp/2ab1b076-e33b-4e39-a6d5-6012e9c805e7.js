function func(nums) {
    if (nums.length === 0) return 0;
    let dp = new Array(nums.length).fill(1);
    for (let i = 1; i < nums.length; i++) {
        for (let j = 0; j < i; j++) {
            if (nums[i] > nums[j]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
            }
        }
    }
    return Math.max(...dp);
}

try {
    const result = func([1,2,3,4,5]);
    console.log(JSON.stringify(result));
} catch (error) {
    console.error('ERROR: ' + error.message);
    process.exit(1);
}
