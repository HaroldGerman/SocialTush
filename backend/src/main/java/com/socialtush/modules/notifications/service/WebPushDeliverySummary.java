package com.socialtush.modules.notifications.service;

public record WebPushDeliverySummary(int attempted, int success, int failed, int expired) {
    public static WebPushDeliverySummary empty() {
        return new WebPushDeliverySummary(0, 0, 0, 0);
    }
}
